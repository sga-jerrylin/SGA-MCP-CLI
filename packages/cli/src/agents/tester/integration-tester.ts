import { exec, spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_STARTUP_WAIT_MS = 3000;

export interface IntegrationTestInput {
  dir: string;
  baseUrl: string;
  authEnv: Record<string, string>;
}

export interface IntegrationTestReport {
  passed: boolean;
  toolsFound: number;
  toolsCalled: string[];
  error?: string;
  serverLog?: string;
}

export interface IntegrationTesterDeps {
  exec?: (command: string, options?: object) => Promise<{ stdout: string }>;
  spawn?: typeof nodeSpawn;
  startupWaitMs?: number;
}

type JsonRpcMessage = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function frameMcpMessage(msg: object): Buffer {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  return Buffer.from(header + body);
}

function parseMcpMessages(data: Buffer): { messages: JsonRpcMessage[]; rest: Buffer } {
  const messages: JsonRpcMessage[] = [];
  let offset = 0;

  while (offset < data.length) {
    const headerEnd = data.indexOf('\r\n\r\n', offset, 'utf8');
    if (headerEnd === -1) {
      break;
    }

    const headerText = data.slice(offset, headerEnd).toString('utf8');
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      break;
    }

    const bodyLen = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + bodyLen;
    if (bodyEnd > data.length) {
      break;
    }

    const body = data.slice(bodyStart, bodyEnd).toString('utf8');
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        messages.push(parsed as JsonRpcMessage);
      }
    } catch {
      // Ignore malformed messages in parser.
    }

    offset = bodyEnd;
  }

  return {
    messages,
    rest: data.slice(offset)
  };
}

export class IntegrationTester {
  private readonly exec: (command: string, options?: object) => Promise<{ stdout: string }>;
  private readonly spawn: typeof nodeSpawn;
  private readonly startupWaitMs: number;

  public constructor(deps: IntegrationTesterDeps = {}) {
    this.exec =
      deps.exec ?? ((command, options) => execAsync(command, { windowsHide: true, ...options }));
    this.spawn = deps.spawn ?? nodeSpawn;
    this.startupWaitMs = deps.startupWaitMs ?? DEFAULT_STARTUP_WAIT_MS;
  }

  public async run(input: IntegrationTestInput): Promise<IntegrationTestReport> {
    try {
      await this.exec('npm install --legacy-peer-deps', { cwd: input.dir, timeout: 120_000 });
      await this.exec('npm run build', { cwd: input.dir, timeout: 120_000 });
    } catch (error) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: `Build failed: ${errorMessage(error)}`
      };
    }

    const serverLogs: string[] = [];
    let serverProcess: ChildProcess | undefined;

    try {
      const env = {
        ...process.env,
        ...input.authEnv,
        MCP_BASE_URL: input.baseUrl
      };
      serverProcess = this.spawn('node', ['dist/index.js'], {
        cwd: input.dir,
        env,
        windowsHide: true
      });
      serverProcess.stderr?.on('data', (chunk: Buffer | string) => {
        serverLogs.push(typeof chunk === 'string' ? chunk : chunk.toString());
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

      await sleep(this.startupWaitMs);

      const writeMessage = (message: JsonRpcMessage): void => {
        if (!serverProcess?.stdin) {
          throw new Error('Server stdin is not available');
        }
        serverProcess.stdin.write(frameMcpMessage(message));
      };

      const waitForResponseById = async (id: number, timeoutMs = 5000): Promise<JsonRpcMessage> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const idx = messageQueue.findIndex((message) => message.id === id);
          if (idx >= 0) {
            const [found] = messageQueue.splice(idx, 1);
            return found;
          }
          await sleep(25);
        }
        throw new Error(`Timeout waiting for MCP response id=${id}`);
      };

      writeMessage({
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
      });
      await waitForResponseById(1);

      writeMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });

      writeMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });
      const toolsListResponse = await waitForResponseById(2);

      const result = toolsListResponse.result as { tools?: Array<{ name?: unknown }> } | undefined;
      const tools =
        result?.tools?.filter((tool): tool is { name: string } => typeof tool?.name === 'string') ??
        [];

      if (!toolsListResponse.result && toolsListResponse.error) {
        throw new Error(`tools/list failed: ${JSON.stringify(toolsListResponse.error)}`);
      }

      return {
        passed: true,
        toolsFound: tools.length,
        toolsCalled: [],
        serverLog: serverLogs.slice(-20).join('')
      };
    } catch (error) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: errorMessage(error),
        serverLog: serverLogs.slice(-20).join('')
      };
    } finally {
      serverProcess?.kill();
    }
  }
}
