import { exec, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { Command } from 'commander';
import chalk from 'chalk';

import {
  frameMcpMessage,
  parseMcpMessages,
  type JsonRpcMessage
} from '../agents/tester/integration-tester';

const execAsync = promisify(exec);
const MCP_INIT_TIMEOUT_MS = 20_000;
const MCP_TOOLS_LIST_TIMEOUT_MS = 20_000;
const MCP_TOOL_CALL_TIMEOUT_MS = 60_000;

interface ManifestCredential {
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}

interface ManifestFile {
  entrypoint?: string;
  credentials?: ManifestCredential[];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sampleValue(paramName: string, schema: Record<string, unknown>): unknown {
  const enumValues = Array.isArray(schema.enum) ? schema.enum : [];
  if (enumValues.length > 0) {
    return enumValues[0];
  }

  const lowerName = paramName.toLowerCase();
  const type = typeof schema.type === 'string' ? schema.type.toLowerCase() : 'string';

  if (lowerName.includes('url')) return 'http://localhost:8888/v1/agent/health';
  if (lowerName.includes('max_pages')) return 1;
  if (lowerName.includes('max_depth')) return 1;
  if (lowerName === 'limit' || lowerName.endsWith('_limit')) return 3;
  if (lowerName === 'page_size' || lowerName === 'pagesize') return 5;
  if (lowerName === 'page') return 1;
  if (
    lowerName === 'q' ||
    lowerName.includes('query') ||
    lowerName.includes('keyword') ||
    lowerName.includes('search')
  ) {
    return 'health';
  }
  if (lowerName.includes('id')) return '1';

  switch (type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return 'test';
  }
}

function buildToolArgs(inputSchema: unknown): Record<string, unknown> {
  const schema = asRecord(inputSchema);
  const properties = asRecord(schema.properties);
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : [];

  const args: Record<string, unknown> = {};
  for (const name of required) {
    args[name] = sampleValue(name, asRecord(properties[name]));
  }

  const throttleOptionDefaults: Record<string, number> = {
    limit: 3,
    max_pages: 1,
    max_depth: 1,
    page_size: 5,
    pagesize: 5,
    page: 1
  };
  for (const [key, value] of Object.entries(throttleOptionDefaults)) {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      continue;
    }
    const schema = asRecord(properties[key]);
    const type = typeof schema.type === 'string' ? schema.type.toLowerCase() : '';
    if (type !== 'integer' && type !== 'number' && type !== '') {
      continue;
    }
    args[key] = value;
  }
  return args;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return ask(question);
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const wasRaw = stdin.isRaw;
    let value = '';

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdout.write('\n');
    };

    const onData = (chunk: Buffer | string) => {
      const key = chunk.toString('utf8');

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(value.trim());
        return;
      }

      if (key === '\u0003') {
        cleanup();
        reject(new Error('Input interrupted'));
        return;
      }

      if (key === '\b' || key === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += key;
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function readManifest(workDir: string): ManifestFile {
  const manifestPath = resolve(workDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json not found: ${manifestPath}`);
  }

  const raw = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('manifest.json must be a JSON object');
  }

  return parsed as ManifestFile;
}

async function collectCredentialEnv(
  credentials: ManifestCredential[]
): Promise<Record<string, string>> {
  const envVars: Record<string, string> = {};

  for (const credential of credentials) {
    if (!credential || typeof credential.key !== 'string' || credential.key.trim().length === 0) {
      continue;
    }

    const keyName = credential.key.trim();
    const label =
      typeof credential.label === 'string' && credential.label.trim().length > 0
        ? credential.label.trim()
        : keyName;
    const required = credential.required === true;
    const defaultValue =
      typeof credential.defaultValue === 'string' && credential.defaultValue.trim().length > 0
        ? credential.defaultValue
        : '';

    for (;;) {
      const requiredHint = required ? ' (required)' : '';
      const defaultHint = defaultValue ? ` [default: ${defaultValue}]` : '';
      const prompt = `  ${label} (${keyName})${requiredHint}${defaultHint}: `;

      const input = credential.type === 'password' ? await askHidden(prompt) : await ask(prompt);

      const value = input || defaultValue;
      if (required && !value) {
        console.log(chalk.red(`  ${keyName} is required.`));
        continue;
      }

      if (value) {
        envVars[keyName] = value;
      }
      break;
    }
  }

  return envVars;
}

function createWaitForResponse(
  queue: JsonRpcMessage[]
): (id: number, timeoutMs?: number) => Promise<JsonRpcMessage> {
  return async (id: number, timeoutMs = 5000): Promise<JsonRpcMessage> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = queue.findIndex((message) => message.id === id);
      if (idx >= 0) {
        const [message] = queue.splice(idx, 1);
        return message;
      }
      await sleep(25);
    }
    throw new Error(`Timeout waiting for MCP response id=${id}`);
  };
}

function responseError(response: JsonRpcMessage): unknown {
  return Object.prototype.hasOwnProperty.call(response, 'error')
    ? (response as { error?: unknown }).error
    : undefined;
}

function responseResult(response: JsonRpcMessage): unknown {
  return Object.prototype.hasOwnProperty.call(response, 'result')
    ? (response as { result?: unknown }).result
    : undefined;
}

function summarizeConnectionResult(result: unknown): string {
  if (!result) {
    return 'empty result';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'object' && result !== null) {
    const content = (result as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const textPart = content.find(
        (item) =>
          item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
      ) as { text?: string } | undefined;
      if (textPart?.text) {
        return textPart.text;
      }
    }
  }

  return JSON.stringify(result);
}

function ensureEntrypoint(workDir: string, manifest: ManifestFile): string {
  const entrypoint =
    typeof manifest.entrypoint === 'string' && manifest.entrypoint.trim().length > 0
      ? manifest.entrypoint.trim()
      : 'dist/index.js';
  return resolve(workDir, entrypoint);
}

async function buildIfNeeded(workDir: string, entrypointPath: string): Promise<void> {
  if (existsSync(entrypointPath)) {
    return;
  }

  await execAsync('pnpm install', { cwd: workDir, timeout: 120_000, windowsHide: true });
  await execAsync('pnpm run build', { cwd: workDir, timeout: 120_000, windowsHide: true });
}

export async function testCommand(dir: string): Promise<void> {
  const workDir = resolve(dir);

  console.log(chalk.cyan('  Reading manifest.json...'));
  const manifest = readManifest(workDir);

  const credentials = Array.isArray(manifest.credentials) ? manifest.credentials : [];
  console.log(chalk.gray(`  Found ${credentials.length} credentials`));

  const credentialEnv = await collectCredentialEnv(credentials);

  let entrypointPath = ensureEntrypoint(workDir, manifest);
  if (!existsSync(entrypointPath)) {
    console.log(chalk.cyan('  Entrypoint missing, running pnpm install && pnpm run build...'));
    await buildIfNeeded(workDir, entrypointPath);
    entrypointPath = ensureEntrypoint(workDir, manifest);
  }

  if (!existsSync(entrypointPath)) {
    throw new Error(`Entrypoint not found after build: ${entrypointPath}`);
  }

  console.log(chalk.cyan('  Starting MCP server...'));

  const serverLogs: string[] = [];
  const messageQueue: JsonRpcMessage[] = [];
  const waitForResponseById = createWaitForResponse(messageQueue);

  let serverProcess: ChildProcessWithoutNullStreams | undefined;
  let stdoutBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0) as Buffer<ArrayBufferLike>;

  try {
    serverProcess = spawn('node', [entrypointPath], {
      cwd: workDir,
      env: {
        ...process.env,
        ...credentialEnv
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stderr.on('data', (chunk: Buffer | string) => {
      serverLogs.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });

    serverProcess.stdout.on('data', (chunk: Buffer | string) => {
      const next = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      stdoutBuffer = Buffer.concat([stdoutBuffer, next]);
      const parsed = parseMcpMessages(stdoutBuffer);
      stdoutBuffer = parsed.rest;
      messageQueue.push(...parsed.messages);
    });

    await sleep(2000);

    const writeMessage = (message: JsonRpcMessage): void => {
      if (!serverProcess?.stdin) {
        throw new Error('Server stdin is not available');
      }
      serverProcess.stdin.write(frameMcpMessage(message));
    };

    writeMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-claw-test',
          version: '1.0.0'
        }
      }
    });

    const initResponse = await waitForResponseById(1, MCP_INIT_TIMEOUT_MS);
    if (responseError(initResponse)) {
      throw new Error(`initialize failed: ${JSON.stringify(responseError(initResponse))}`);
    }
    console.log(chalk.green('  OK initialize'));

    writeMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    writeMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    const toolsListResponse = await waitForResponseById(2, MCP_TOOLS_LIST_TIMEOUT_MS);
    if (responseError(toolsListResponse)) {
      throw new Error(`tools/list failed: ${JSON.stringify(responseError(toolsListResponse))}`);
    }

    const result = responseResult(toolsListResponse) as
      | {
          tools?: Array<{ name?: unknown; inputSchema?: unknown }>;
        }
      | undefined;
    const tools =
      result?.tools?.filter(
        (tool): tool is { name: string; inputSchema?: unknown } => typeof tool?.name === 'string'
      ) ?? [];

    console.log(chalk.green(`  OK tools/list: ${tools.length} tools`));
    if (tools.length > 0) {
      console.log(chalk.gray(`  ${tools.map((tool) => tool.name).join(', ')}`));
    }

    let nextCallId = 3;
    const hasConnectionTest = tools.some((tool) => tool.name === 'test_connection');
    if (hasConnectionTest) {
      const callId = nextCallId++;
      writeMessage({
        jsonrpc: '2.0',
        id: callId,
        method: 'tools/call',
        params: {
          name: 'test_connection',
          arguments: {}
        }
      });

      const testConnResponse = await waitForResponseById(callId, MCP_TOOL_CALL_TIMEOUT_MS);
      if (responseError(testConnResponse)) {
        console.log(
          chalk.red(`  FAIL test_connection: ${JSON.stringify(responseError(testConnResponse))}`)
        );
        throw new Error('test_connection failed');
      }

      const detail = summarizeConnectionResult(responseResult(testConnResponse));
      console.log(chalk.green(`  OK test_connection: ${detail}`));
    }

    const executableTools = tools.filter((tool) => tool.name !== 'test_connection');
    let failedTools = 0;
    for (const tool of executableTools) {
      const args = buildToolArgs(tool.inputSchema);
      const callId = nextCallId++;
      writeMessage({
        jsonrpc: '2.0',
        id: callId,
        method: 'tools/call',
        params: {
          name: tool.name,
          arguments: args
        }
      });

      const callResponse = await waitForResponseById(callId, MCP_TOOL_CALL_TIMEOUT_MS);
      const callErr = responseError(callResponse);
      const callResult = responseResult(callResponse) as { isError?: unknown } | undefined;
      const isErrorResult = Boolean(callResult && callResult.isError === true);

      if (callErr || isErrorResult) {
        failedTools += 1;
        console.log(
          chalk.red(
            `  FAIL ${tool.name}: ${callErr ? JSON.stringify(callErr) : summarizeConnectionResult(callResult)}`
          )
        );
      } else {
        console.log(chalk.green(`  OK ${tool.name}`));
      }
    }

    if (failedTools > 0) {
      throw new Error(`${failedTools}/${executableTools.length} tools failed`);
    }

    console.log('');
    console.log(chalk.green('  All checks passed.'));
  } finally {
    serverProcess?.kill();
    if (serverLogs.length > 0 && process.env.DEBUG) {
      console.log(chalk.gray('\n  Server logs:'));
      console.log(chalk.gray(serverLogs.slice(-20).join('')));
    }
  }
}

export function registerTestCommand(program: Command): void {
  program
    .command('test [dir]')
    .description('Test MCP server connectivity and credentials')
    .action(async (dir?: string) => {
      try {
        await testCommand(dir ?? process.cwd());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exitCode = 1;
      }
    });
}
