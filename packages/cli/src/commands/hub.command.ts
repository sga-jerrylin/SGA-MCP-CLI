import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { SgaConfig } from '../config/sga-config';

const DEFAULT_HUB_URL = 'http://localhost:3000/api/mcp';

interface HubConnectConfig {
  hubName: string;
  hubSseUrl: string;
  toolCount: number;
  clients: {
    claudeCode: { label: 'Claude Code'; command: string };
    claudeDesktop: {
      label: 'Claude Desktop';
      config: Record<string, unknown>;
      filePath: string;
    };
    cursor: {
      label: 'Cursor';
      config: Record<string, unknown>;
      filePath: string;
    };
    windsurf: {
      label: 'Windsurf';
      config: Record<string, unknown>;
      filePath: string;
    };
    vscode: {
      label: 'VS Code (Copilot)';
      config: Record<string, unknown>;
      filePath: string;
    };
    augment: { label: 'Augment Code'; instruction: string };
    dify: { label: 'Dify'; instruction: string };
    hiagent: { label: 'HiAgent'; instruction: string };
    mcpClaw: { label: 'mcp-claw'; command: string };
    genericSse: { label: 'Generic SSE'; url: string };
  };
}

interface HubConnectResponse {
  code?: number;
  message?: string;
  data?: HubConnectConfig;
}

interface HubConnectOptions {
  claude?: boolean;
  cursor?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readConfiguredHubUrl(): string | null {
  const config = new SgaConfig();
  const value = config.get('hub.url');
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHubUrl(raw: string): string {
  const parsed = new URL(raw);
  const normalizedPath = parsed.pathname.replace(/\/+$/, '');

  if (normalizedPath === '' || normalizedPath === '/') {
    parsed.pathname = '/api/mcp';
  } else if (normalizedPath.endsWith('/api/mcp/connect')) {
    parsed.pathname = normalizedPath.slice(0, -'/connect'.length);
  } else if (normalizedPath.endsWith('/api/mcp')) {
    parsed.pathname = normalizedPath;
  } else {
    parsed.pathname = `${normalizedPath}/api/mcp`;
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function getConnectEndpoint(hubUrl: string): string {
  const parsed = new URL(hubUrl);
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/connect`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

async function fetchConnectConfig(hubUrl: string): Promise<HubConnectConfig> {
  const response = await fetch(getConnectEndpoint(hubUrl), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Hub responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as unknown;
  const unwrapped = isRecord(body) && 'data' in body ? (body as HubConnectResponse).data : body;
  if (
    !isRecord(unwrapped) ||
    typeof unwrapped.hubName !== 'string' ||
    typeof unwrapped.hubSseUrl !== 'string' ||
    typeof unwrapped.toolCount !== 'number' ||
    !isRecord(unwrapped.clients)
  ) {
    throw new Error('Invalid Hub connect response');
  }

  return unwrapped as unknown as HubConnectConfig;
}

function saveHubUrl(hubUrl: string): void {
  const config = new SgaConfig();
  config.set('hub.url', hubUrl);
}

function mergeCursorConfig(
  existing: unknown,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const existingObj = isRecord(existing) ? existing : {};
  const merged: Record<string, unknown> = { ...existingObj, ...incoming };

  const existingServers = isRecord(existingObj.mcpServers) ? existingObj.mcpServers : {};
  const incomingServers = isRecord(incoming.mcpServers) ? incoming.mcpServers : {};
  merged.mcpServers = { ...existingServers, ...incomingServers };

  return merged;
}

function autoConfigureCursor(config: HubConnectConfig): string {
  const targetPath = path.resolve(process.cwd(), '.cursor', 'mcp.json');
  mkdirSync(path.dirname(targetPath), { recursive: true });

  let existing: unknown = {};
  if (existsSync(targetPath)) {
    try {
      existing = JSON.parse(readFileSync(targetPath, 'utf8')) as unknown;
    } catch {
      existing = {};
    }
  }

  const merged = mergeCursorConfig(existing, config.clients.cursor.config);
  writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return targetPath;
}

function printConnectSummary(config: HubConnectConfig): void {
  console.log(chalk.bold('\nHub Connect Configuration'));
  console.log(`${chalk.cyan('Hub')}: ${config.hubName}`);
  console.log(`${chalk.cyan('SSE URL')}: ${config.hubSseUrl}`);
  console.log(`${chalk.cyan('Tool Count')}: ${config.toolCount}`);

  console.log(chalk.bold('\nClient Commands'));
  console.log(`${chalk.green('Claude Code')}: ${config.clients.claudeCode.command}`);
  console.log(`${chalk.green('mcp-claw')}: ${config.clients.mcpClaw.command}`);
  console.log(`${chalk.green('Generic SSE')}: ${config.clients.genericSse.url}`);

  console.log(chalk.bold('\nClient Config Paths'));
  console.log(`${chalk.green('Claude Desktop')}: ${config.clients.claudeDesktop.filePath}`);
  console.log(`${chalk.green('Cursor')}: ${config.clients.cursor.filePath}`);
  console.log(`${chalk.green('Windsurf')}: ${config.clients.windsurf.filePath}`);
  console.log(`${chalk.green('VS Code (Copilot)')}: ${config.clients.vscode.filePath}`);

  console.log(chalk.bold('\nOther Integrations'));
  console.log(`${chalk.green('Augment')}: ${config.clients.augment.instruction}`);
  console.log(`${chalk.green('Dify')}: ${config.clients.dify.instruction}`);
  console.log(`${chalk.green('HiAgent')}: ${config.clients.hiagent.instruction}`);
  console.log('');
}

function resolveTargetHubUrl(rawUrl?: string): string {
  const configured = readConfiguredHubUrl();
  const chosen = rawUrl?.trim() || configured || DEFAULT_HUB_URL;
  return normalizeHubUrl(chosen);
}

export async function hubConnectCommand(
  rawUrl?: string,
  options: HubConnectOptions = {}
): Promise<void> {
  const hubUrl = resolveTargetHubUrl(rawUrl);
  const config = await fetchConnectConfig(hubUrl);
  const finalHubUrl = normalizeHubUrl(config.hubSseUrl || hubUrl);

  saveHubUrl(finalHubUrl);
  console.log(chalk.green(`Connected to Hub: ${finalHubUrl}`));
  printConnectSummary(config);

  if (options.claude) {
    try {
      console.log(chalk.dim(`Running: ${config.clients.claudeCode.command}`));
      execSync(config.clients.claudeCode.command, { stdio: 'inherit' });
      console.log(chalk.green('Claude Code configured successfully.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`Failed to configure Claude Code automatically: ${message}`));
    }
  }

  if (options.cursor) {
    try {
      const targetPath = autoConfigureCursor(config);
      console.log(chalk.green(`Cursor config written to ${targetPath}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`Failed to write Cursor config: ${message}`));
    }
  }
}

export async function hubStatusCommand(): Promise<void> {
  const configured = readConfiguredHubUrl();
  if (!configured) {
    console.log(chalk.yellow('Hub is not configured. Run: mcp-claw hub connect'));
    process.exitCode = 1;
    return;
  }

  const hubUrl = normalizeHubUrl(configured);
  try {
    const config = await fetchConnectConfig(hubUrl);
    console.log(chalk.green('Hub status: connected'));
    console.log(`${chalk.cyan('URL')}: ${normalizeHubUrl(config.hubSseUrl || hubUrl)}`);
    console.log(`${chalk.cyan('Hub')}: ${config.hubName}`);
    console.log(`${chalk.cyan('Tool Count')}: ${config.toolCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red('Hub status: disconnected'));
    console.log(chalk.red(message));
    process.exitCode = 1;
  }
}

export function registerHubCommand(program: Command): void {
  const hub = program.command('hub').description('Connect and manage MCP Hub settings');

  hub
    .command('connect [url]')
    .description('Connect to an MCP Hub and save hub.url in config')
    .option('--claude', 'Automatically run Claude Code setup command')
    .option('--cursor', 'Automatically write .cursor/mcp.json')
    .action(async (url: string | undefined, options: HubConnectOptions) => {
      await hubConnectCommand(url, options);
    });

  hub
    .command('status')
    .description('Check Hub connectivity using configured hub.url')
    .action(async () => {
      await hubStatusCommand();
    });
}
