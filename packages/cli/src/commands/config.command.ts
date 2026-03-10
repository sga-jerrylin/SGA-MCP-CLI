import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';

import { DEFAULT_CONFIG_PATH, SgaConfig } from '../config/sga-config';
import { OpenRouterProvider } from '../llm/llm-client';
import { getBaseUrlForProvider, getProviderForModel } from '../llm/provider-routing';

const MODEL_IDS = [
  'google/gemini-3-flash-preview',
  'qwen3-coder-plus',
  'qwen3-coder-next',
  'qwen3-max',
  'qwen3.5-plus',
  'glm-5',
  'glm-4.7',
  'kimi-k2.5',
  'MiniMax-M2.5'
] as const;

const MODEL_ID_SET = new Set<string>(MODEL_IDS);

type Logger = Pick<Console, 'log' | 'error'>;

interface EnvFileState {
  path: string;
  lines: string[];
  values: Map<string, string>;
}

interface ConfigValues {
  parserModel: string;
  coderModel: string;
  agentModel: string;
  apiKey: string;
}

interface SetConfigOptions {
  parser?: string;
  coder?: string;
  agent?: string;
  key?: string;
}

function findEnvPath(startDir: string, maxLevels = 4): string {
  let currentDir = resolve(startDir);

  for (let level = 0; level <= maxLevels; level += 1) {
    const candidate = resolve(currentDir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  throw new Error('Unable to locate .env file from current directory (searched up to 4 levels).');
}

function parseEnvState(path: string): EnvFileState {
  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  const values = new Map<string, string>();

  for (const line of lines) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    values.set(match[1], match[2]);
  }

  return { path, lines, values };
}

function writeEnvState(state: EnvFileState): void {
  writeFileSync(state.path, `${state.lines.join('\n')}\n`, 'utf8');
}

function upsertEnvKey(state: EnvFileState, key: string, value: string): void {
  const lineRegex = new RegExp(`^${key}=.*$`);
  const serialized = `${key}=${value}`;
  const existingIndex = state.lines.findIndex((line) => lineRegex.test(line));

  if (existingIndex >= 0) {
    state.lines[existingIndex] = serialized;
  } else {
    state.lines.push(serialized);
  }

  state.values.set(key, value);
}

function currentConfig(state: EnvFileState): ConfigValues {
  return {
    parserModel: state.values.get('LLM_PARSER_MODEL') ?? '',
    coderModel: state.values.get('LLM_CODER_MODEL') ?? '',
    agentModel: state.values.get('LLM_AGENT_MODEL') ?? '',
    apiKey: state.values.get('OPENROUTER_API_KEY') ?? state.values.get('CODING_PLAN_API_KEY') ?? ''
  };
}

function validateModel(model: string, optionName: string): void {
  if (!MODEL_ID_SET.has(model)) {
    throw new Error(
      `Invalid ${optionName} model: ${model}\nAllowed models:\n- ${MODEL_IDS.join('\n- ')}`
    );
  }
}

function parseConfigValue(raw: string): string | number | boolean {
  const value = raw.trim();
  const lower = value.toLowerCase();

  if (lower === 'true') {
    return true;
  }
  if (lower === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return raw;
}

export function showConfig(logger: Logger = console, cwd = process.cwd()): void {
  const envPath = findEnvPath(cwd);
  const state = parseEnvState(envPath);
  const config = currentConfig(state);

  const rows: Array<[string, string]> = [
    ['LLM_PARSER_MODEL', config.parserModel],
    ['LLM_CODER_MODEL', config.coderModel],
    ['LLM_AGENT_MODEL', config.agentModel],
    ['OPENROUTER_API_KEY / CODING_PLAN_API_KEY', config.apiKey]
  ];

  const keyWidth = Math.max(...rows.map(([key]) => key.length));
  logger.log(chalk.gray(`.env: ${envPath}`));
  for (const [key, value] of rows) {
    const shownValue = value.length > 0 ? value : '(empty)';
    logger.log(`${chalk.cyan(key.padEnd(keyWidth))} = ${chalk.green(shownValue)}`);
  }

  const sgaConfig = new SgaConfig();
  const allConfig = sgaConfig.getAll();

  logger.log('');
  logger.log(chalk.gray(`~/.sga/config.yaml: ${DEFAULT_CONFIG_PATH}`));
  if (Object.keys(allConfig).length === 0) {
    logger.log(chalk.yellow('(empty)'));
  } else {
    logger.log(chalk.green(JSON.stringify(allConfig, null, 2)));
  }
}

export function setConfig(
  options: SetConfigOptions,
  logger: Logger = console,
  cwd = process.cwd()
): void {
  const envPath = findEnvPath(cwd);
  const state = parseEnvState(envPath);

  const updates: Array<[string, string]> = [];

  if (typeof options.parser === 'string') {
    validateModel(options.parser, '--parser');
    updates.push(['LLM_PARSER_MODEL', options.parser]);
  }

  if (typeof options.coder === 'string') {
    validateModel(options.coder, '--coder');
    updates.push(['LLM_CODER_MODEL', options.coder]);
  }

  if (typeof options.agent === 'string') {
    validateModel(options.agent, '--agent');
    updates.push(['LLM_AGENT_MODEL', options.agent]);
  }

  if (typeof options.key === 'string') {
    updates.push(['OPENROUTER_API_KEY', options.key]);
  }

  if (updates.length === 0) {
    throw new Error('No config field specified. Use --parser, --coder, --agent, or --key.');
  }

  for (const [key, value] of updates) {
    upsertEnvKey(state, key, value);
  }

  writeEnvState(state);
  logger.log(chalk.green(`Updated ${updates.length} setting(s) in ${envPath}`));

  // Also persist to ~/.sga/config.yaml so global `mcp-claw` works without .env
  const globalConfig = new SgaConfig();
  if (typeof options.key === 'string') {
    // Determine which yaml key to write based on the currently selected model
    const currentModel = (globalConfig.get('model.coder') as string | undefined) ?? '';
    const modelProv = getProviderForModel(currentModel);
    const yamlKey = modelProv === 'coding-plan' ? 'coding-plan.apiKey' : 'openrouter.apiKey';
    globalConfig.set(yamlKey, options.key);
  }
  if (typeof options.parser === 'string') {
    globalConfig.set('model.parser', options.parser);
  }
  if (typeof options.coder === 'string') {
    globalConfig.set('model.coder', options.coder);
  }
  if (typeof options.agent === 'string') {
    globalConfig.set('model.agent', options.agent);
  }
  logger.log(chalk.green(`Synced to ${DEFAULT_CONFIG_PATH}`));
}

export function setSgaConfig(
  key: string,
  value: string | number | boolean,
  logger: Logger = console
): void {
  const config = new SgaConfig();
  config.set(key, value);
  logger.log(chalk.green(`Updated ${key} in ${DEFAULT_CONFIG_PATH}`));
}

export async function testConfig(logger: Logger = console, cwd = process.cwd()): Promise<void> {
  const envPath = findEnvPath(cwd);
  const state = parseEnvState(envPath);
  const config = currentConfig(state);

  const model = config.parserModel || 'google/gemini-3-flash-preview';
  const apiKey = config.apiKey;

  if (!apiKey) {
    logger.error(chalk.red('Connection failed: API key is empty'));
    process.exitCode = 1;
    return;
  }

  const modelProvider = getProviderForModel(model);
  const baseUrl = getBaseUrlForProvider(modelProvider);
  const provider = new OpenRouterProvider('test', model, apiKey, baseUrl);

  try {
    await provider.complete('Reply with exactly: pong');
    logger.log(chalk.green(`LLM reachable, model: ${model}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red(`Connection failed: ${message}`));
    process.exitCode = 1;
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Show and update LLM/OpenRouter configuration');

  config
    .command('show')
    .description('Show settings from .env and ~/.sga/config.yaml')
    .action(() => {
      showConfig(console);
    });

  config
    .command('set <key> <value>')
    .description('Set a key in ~/.sga/config.yaml (supports dot notation)')
    .action((key: string, value: string) => {
      setSgaConfig(key, parseConfigValue(value), console);
    });

  config
    .command('set-env')
    .description('Update one or more model settings in .env')
    .option('--parser <model>', 'Set LLM_PARSER_MODEL')
    .option('--coder <model>', 'Set LLM_CODER_MODEL')
    .option('--agent <model>', 'Set LLM_AGENT_MODEL')
    .option('--key <apiKey>', 'Set OPENROUTER_API_KEY')
    .action((options: SetConfigOptions) => {
      setConfig(options, console);
    });

  config
    .command('test')
    .description('Test OpenRouter connectivity')
    .action(async () => {
      await testConfig(console);
    });
}
