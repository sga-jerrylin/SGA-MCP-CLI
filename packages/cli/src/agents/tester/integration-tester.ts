import { exec, spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_STARTUP_WAIT_MS = 1500;
const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000;
const DEFAULT_TOOLS_LIST_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 15_000;
const DEFAULT_AUTH_PROBE_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 25;

export interface IntegrationTestInput {
  dir: string;
  baseUrl: string;
  authEnv: Record<string, string>;
}

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface IntegrationTestReport {
  passed: boolean;
  toolsFound: number;
  toolsCalled: string[];
  tools?: DiscoveredTool[];
  toolResults?: Array<{
    name: string;
    ok: boolean;
    detail?: string;
    args?: Record<string, unknown>;
  }>;
  allToolsPassed?: boolean;
  connectionTest?: { ok: boolean; detail?: string };
  authProbe?: { authRequired: boolean; authHint?: string; toolName?: string };
  error?: string;
  serverLog?: string;
}

export interface IntegrationTesterDeps {
  exec?: (command: string, options?: object) => Promise<{ stdout: string }>;
  spawn?: typeof nodeSpawn;
  startupWaitMs?: number;
  initializeTimeoutMs?: number;
  toolsListTimeoutMs?: number;
  connectionTimeoutMs?: number;
  authProbeTimeoutMs?: number;
  pollIntervalMs?: number;
}

export type JsonRpcMessage = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizePayload(payload: unknown, maxLength = 300): string {
  let text: string;
  if (typeof payload === 'string') {
    text = payload;
  } else {
    try {
      text = JSON.stringify(payload);
    } catch {
      text = String(payload);
    }
  }

  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function isAuthRelated(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /\b401\b/.test(normalized) ||
    /\b403\b/.test(normalized) ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('api.key') ||
    normalized.includes('api_key') ||
    normalized.includes('api key')
  );
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

  if (lowerName.includes('url')) {
    return 'https://example.com';
  }
  if (
    lowerName === 'q' ||
    lowerName.includes('query') ||
    lowerName.includes('keyword') ||
    lowerName.includes('search')
  ) {
    return 'test';
  }
  if (lowerName.includes('email')) {
    return 'test@example.com';
  }
  if (lowerName.includes('id')) {
    return '1';
  }

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

function buildToolArgs(tool: DiscoveredTool): Record<string, unknown> {
  const inputSchema = asRecord(tool.inputSchema);
  const properties = asRecord(inputSchema.properties);
  const required = Array.isArray(inputSchema.required)
    ? inputSchema.required.filter((item): item is string => typeof item === 'string')
    : [];

  const args: Record<string, unknown> = {};
  const requiredSet = new Set(required);

  for (const [name, rawSchema] of Object.entries(properties)) {
    if (!requiredSet.has(name)) {
      continue;
    }
    args[name] = sampleValue(name, asRecord(rawSchema));
  }

  if (Object.keys(args).length === 0) {
    return {};
  }
  return args;
}

function extractToolCallDetail(response: JsonRpcMessage): string {
  const responseError = (response as { error?: unknown }).error;
  if (responseError) {
    return summarizePayload(responseError);
  }

  const result = (response as { result?: unknown }).result;
  if (typeof result === 'string') {
    return summarizePayload(result);
  }

  if (result && typeof result === 'object') {
    const resultRecord = result as Record<string, unknown>;
    const content = resultRecord.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item && typeof item === 'object') {
          const text = (item as { text?: unknown }).text;
          if (typeof text === 'string' && text.trim().length > 0) {
            return summarizePayload(text);
          }
        }
      }
    }
    return summarizePayload(resultRecord);
  }

  return summarizePayload(result);
}

function isToolCallSuccessful(response: JsonRpcMessage): boolean {
  if ((response as { error?: unknown }).error) {
    return false;
  }
  const result = (response as { result?: unknown }).result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const resultRecord = result as Record<string, unknown>;
    if (resultRecord.isError === true) {
      return false;
    }
  }
  return true;
}

export function frameMcpMessage(msg: object): Buffer {
  const payload = Buffer.from(JSON.stringify(msg), 'utf8');
  const header = Buffer.from(`Content-Length: ${String(payload.length)}\r\n\r\n`, 'utf8');
  return Buffer.concat([header, payload]);
}

function frameLegacyMcpMessage(msg: object): Buffer {
  return Buffer.from(`${JSON.stringify(msg)}\n`, 'utf8');
}

export function parseMcpMessages(data: Buffer<ArrayBufferLike>): {
  messages: JsonRpcMessage[];
  rest: Buffer<ArrayBufferLike>;
} {
  const messages: JsonRpcMessage[] = [];
  let rest = Buffer.from(data);

  const pushJson = (raw: string): void => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        messages.push(parsed as JsonRpcMessage);
      }
    } catch {
      // Non-JSON output is treated as plain server log text.
    }
  };

  while (rest.length > 0) {
    const text = rest.toString('utf8');
    const headerMatch = /content-length:/i.exec(text);
    const headerIndex = headerMatch?.index ?? -1;

    if (headerIndex > 0) {
      const prefixText = text.slice(0, headerIndex);
      for (const line of prefixText.split(/\r?\n/)) {
        pushJson(line);
      }
      const dropBytes = Buffer.byteLength(prefixText, 'utf8');
      rest = rest.subarray(dropBytes);
      continue;
    }

    if (headerIndex === 0) {
      const headerEndCrlf = rest.indexOf('\r\n\r\n');
      const headerEndLf = rest.indexOf('\n\n');
      let headerEnd = -1;
      let headerDelimiterLength = 0;

      if (headerEndCrlf >= 0 && (headerEndLf < 0 || headerEndCrlf <= headerEndLf)) {
        headerEnd = headerEndCrlf;
        headerDelimiterLength = 4;
      } else if (headerEndLf >= 0) {
        headerEnd = headerEndLf;
        headerDelimiterLength = 2;
      }

      if (headerEnd === -1) {
        break;
      }
      const headerText = rest.subarray(0, headerEnd).toString('utf8');
      const lengthMatch = /content-length:\s*(\d+)/i.exec(headerText);
      if (!lengthMatch) {
        const newlineIdx = rest.indexOf('\n');
        if (newlineIdx === -1) {
          break;
        }
        rest = rest.subarray(newlineIdx + 1);
        continue;
      }

      const contentLength = Number(lengthMatch[1]);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        const newlineIdx = rest.indexOf('\n');
        if (newlineIdx === -1) {
          break;
        }
        rest = rest.subarray(newlineIdx + 1);
        continue;
      }

      const frameEnd = headerEnd + headerDelimiterLength + contentLength;
      if (rest.length < frameEnd) {
        break;
      }

      const body = rest.subarray(headerEnd + headerDelimiterLength, frameEnd).toString('utf8');
      pushJson(body);
      rest = rest.subarray(frameEnd);
      continue;
    }

    const newlineIdx = rest.indexOf('\n');
    if (newlineIdx === -1) {
      break;
    }
    const line = rest.subarray(0, newlineIdx).toString('utf8').replace(/\r$/, '');
    pushJson(line);
    rest = rest.subarray(newlineIdx + 1);
  }

  return {
    messages,
    rest
  };
}

export class IntegrationTester {
  private readonly exec: (command: string, options?: object) => Promise<{ stdout: string }>;
  private readonly spawn: typeof nodeSpawn;
  private readonly startupWaitMs: number;
  private readonly initializeTimeoutMs: number;
  private readonly toolsListTimeoutMs: number;
  private readonly connectionTimeoutMs: number;
  private readonly authProbeTimeoutMs: number;
  private readonly pollIntervalMs: number;

  public constructor(deps: IntegrationTesterDeps = {}) {
    this.exec =
      deps.exec ?? ((command, options) => execAsync(command, { windowsHide: true, ...options }));
    this.spawn = deps.spawn ?? nodeSpawn;
    this.startupWaitMs = deps.startupWaitMs ?? DEFAULT_STARTUP_WAIT_MS;
    this.initializeTimeoutMs = deps.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS;
    this.toolsListTimeoutMs = deps.toolsListTimeoutMs ?? DEFAULT_TOOLS_LIST_TIMEOUT_MS;
    this.connectionTimeoutMs = deps.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
    this.authProbeTimeoutMs = deps.authProbeTimeoutMs ?? DEFAULT_AUTH_PROBE_TIMEOUT_MS;
    this.pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  public async run(input: IntegrationTestInput): Promise<IntegrationTestReport> {
    try {
      await this.exec('pnpm install', { cwd: input.dir, timeout: 120_000 });
      await this.exec('pnpm run build', { cwd: input.dir, timeout: 120_000 });
    } catch (error) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: `Build failed: ${errorMessage(error)}`
      };
    }

    const serverLogs: string[] = [];
    const serverStdoutLogs: string[] = [];
    let serverProcess: ChildProcess | undefined;
    let serverExited = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let spawnError: string | null = null;

    try {
      const env = {
        ...process.env,
        ...input.authEnv,
        MCP_BASE_URL: input.baseUrl,
        BASE_URL: input.baseUrl
      };

      const pushLog = (target: string[], text: string): void => {
        const normalized = text.trim();
        if (!normalized) {
          return;
        }
        target.push(normalized);
        if (target.length > 40) {
          target.splice(0, target.length - 40);
        }
      };

      const diagnostics = (): string => {
        const stderrTail = serverLogs.slice(-20).join('\n').trim();
        const stdoutTail = serverStdoutLogs.slice(-20).join('\n').trim();
        const parts: string[] = [];
        if (stderrTail) {
          parts.push(`stderr:\n${stderrTail}`);
        }
        if (stdoutTail) {
          parts.push(`stdout(non-mcp):\n${stdoutTail}`);
        }
        return parts.length > 0 ? `\n${parts.join('\n\n')}` : '';
      };

      const buildExitError = (id: number): string => {
        const codeText = exitCode === null ? 'null' : String(exitCode);
        const signalText = exitSignal ? `, signal ${exitSignal}` : '';
        return `Server exited (code ${codeText}${signalText}) before responding to id=${id}${diagnostics()}`;
      };

      serverProcess = this.spawn('node', ['dist/index.js'], {
        cwd: input.dir,
        env,
        windowsHide: true
      });
      serverProcess.on('error', (error) => {
        spawnError = errorMessage(error);
      });
      serverProcess.on('exit', (code, signal) => {
        serverExited = true;
        exitCode = code;
        exitSignal = signal;
      });
      serverProcess.stderr?.on('data', (chunk: Buffer | string) => {
        pushLog(serverLogs, typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      });

      const messageQueue: JsonRpcMessage[] = [];
      let stdoutBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      serverProcess.stdout?.on('data', (chunk: Buffer | string) => {
        const chunkBuffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        stdoutBuffer = Buffer.concat([stdoutBuffer, chunkBuffer]);
        const parsed = parseMcpMessages(stdoutBuffer);
        stdoutBuffer = parsed.rest;
        messageQueue.push(...parsed.messages);
      });

      if (this.startupWaitMs > 0) {
        await sleep(this.startupWaitMs);
      }

      const writeMessage = (
        message: JsonRpcMessage,
        mode: 'framed' | 'legacy' = 'framed'
      ): void => {
        if (!serverProcess?.stdin) {
          throw new Error('Server stdin is not available');
        }
        if (spawnError) {
          throw new Error(`Server process error: ${spawnError}${diagnostics()}`);
        }
        if (serverExited) {
          throw new Error(buildExitError(Number(message.id ?? -1)));
        }
        const payload =
          mode === 'legacy' ? frameLegacyMcpMessage(message) : frameMcpMessage(message);
        serverProcess.stdin.write(payload);
      };

      const waitForResponseById = async (
        id: number,
        timeoutMs: number
      ): Promise<JsonRpcMessage> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const idx = messageQueue.findIndex((message) => message.id === id);
          if (idx >= 0) {
            const [found] = messageQueue.splice(idx, 1);
            return found;
          }
          if (spawnError) {
            throw new Error(`Server process error: ${spawnError}${diagnostics()}`);
          }
          if (serverExited) {
            throw new Error(buildExitError(id));
          }
          await sleep(this.pollIntervalMs);
        }
        throw new Error(`Timeout waiting for MCP response id=${id}${diagnostics()}`);
      };

      const initializeMessage: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'integration-test',
            version: '1.0.0'
          }
        }
      };

      const firstInitializeTimeoutMs = Math.min(3000, this.initializeTimeoutMs);
      const secondInitializeTimeoutMs = Math.max(
        this.initializeTimeoutMs - firstInitializeTimeoutMs,
        0
      );

      writeMessage(initializeMessage);
      try {
        await waitForResponseById(1, firstInitializeTimeoutMs);
      } catch (error) {
        const timeoutOnFirstTry =
          error instanceof Error && error.message.includes('Timeout waiting for MCP response id=1');
        if (!timeoutOnFirstTry || serverExited || spawnError || secondInitializeTimeoutMs === 0) {
          throw error;
        }
        // Compatibility fallback for old line-delimited stdio servers.
        writeMessage(initializeMessage, 'legacy');
        await waitForResponseById(1, secondInitializeTimeoutMs);
      }

      writeMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });

      writeMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });
      const toolsListResponse = await waitForResponseById(2, this.toolsListTimeoutMs);

      const resultPayload = toolsListResponse.result as
        | {
            tools?: Array<Record<string, unknown>>;
          }
        | undefined;
      const tools: DiscoveredTool[] =
        resultPayload?.tools
          ?.filter(
            (tool): tool is Record<string, unknown> & { name: string } =>
              typeof tool?.name === 'string'
          )
          .map((tool) => ({
            name: tool.name as string,
            ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
            ...(tool.inputSchema && typeof tool.inputSchema === 'object'
              ? { inputSchema: tool.inputSchema as Record<string, unknown> }
              : {})
          })) ?? [];

      if (!toolsListResponse.result && toolsListResponse.error) {
        throw new Error(`tools/list failed: ${JSON.stringify(toolsListResponse.error)}`);
      }

      const toolsCalled: string[] = [];
      const toolResults: NonNullable<IntegrationTestReport['toolResults']> = [];
      let connectionTest: IntegrationTestReport['connectionTest'];
      let authProbe: IntegrationTestReport['authProbe'];
      let nextCallId = 3;

      // Step 1: test_connection first to validate baseline connectivity.
      const hasTestConnection = tools.some((tool) => tool.name === 'test_connection');
      if (hasTestConnection) {
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
        toolsCalled.push('test_connection');
        const testConnResponse = await waitForResponseById(callId, this.connectionTimeoutMs);
        const ok = isToolCallSuccessful(testConnResponse);
        const detail = extractToolCallDetail(testConnResponse);
        connectionTest = { ok, detail };
        toolResults.push({
          name: 'test_connection',
          ok,
          detail,
          args: {}
        });
      }

      // Step 2: auth probe. Optional and does not change pass/fail by itself.
      const probeTool = tools.find((tool) => tool.name !== 'test_connection');
      if (probeTool) {
        try {
          const probeCallId = nextCallId++;
          writeMessage({
            jsonrpc: '2.0',
            id: probeCallId,
            method: 'tools/call',
            params: {
              name: probeTool.name,
              arguments: {}
            }
          });
          toolsCalled.push(probeTool.name);

          const probeResponse = await waitForResponseById(probeCallId, this.authProbeTimeoutMs);
          const probeError = (probeResponse as { error?: unknown }).error;
          const probeResult = (probeResponse as { result?: unknown }).result;
          const probeText = summarizePayload(probeError ?? probeResult);
          authProbe = {
            authRequired: isAuthRelated(probeText),
            ...(probeText ? { authHint: probeText } : {}),
            toolName: probeTool.name
          };
        } catch (error) {
          authProbe = {
            authRequired: false,
            authHint: summarizePayload(`probe failed: ${errorMessage(error)}`),
            toolName: probeTool.name
          };
        }
      }

      // Step 3: hard requirement - every tool must pass at least one real call.
      for (const tool of tools) {
        if (tool.name === 'test_connection') {
          continue;
        }

        const args = buildToolArgs(tool);
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
        toolsCalled.push(tool.name);

        try {
          const toolResponse = await waitForResponseById(callId, this.connectionTimeoutMs);
          toolResults.push({
            name: tool.name,
            ok: isToolCallSuccessful(toolResponse),
            detail: extractToolCallDetail(toolResponse),
            args
          });
        } catch (error) {
          toolResults.push({
            name: tool.name,
            ok: false,
            detail: `call failed: ${errorMessage(error)}`,
            args
          });
        }
      }

      const executableResults = toolResults.filter((item) => item.name !== 'test_connection');
      const allToolsPassed =
        tools.length > 0 &&
        executableResults.length > 0 &&
        executableResults.every((item) => item.ok);
      const integrationPassed = allToolsPassed && (connectionTest ? connectionTest.ok : true);

      return {
        passed: integrationPassed,
        toolsFound: tools.length,
        toolsCalled,
        tools,
        toolResults,
        allToolsPassed,
        ...(connectionTest ? { connectionTest } : {}),
        ...(authProbe ? { authProbe } : {}),
        serverLog: [...serverLogs, ...serverStdoutLogs].slice(-20).join('\n')
      };
    } catch (error) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: errorMessage(error),
        serverLog: [...serverLogs, ...serverStdoutLogs].slice(-20).join('\n')
      };
    } finally {
      serverProcess?.kill();
    }
  }
}
