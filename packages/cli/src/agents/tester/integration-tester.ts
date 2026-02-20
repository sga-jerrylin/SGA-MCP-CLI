import { exec, spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_STARTUP_WAIT_MS = 3000;
const DEFAULT_MCP_PORT = 13579;

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
  fetchFn?: typeof fetch;
  startupWaitMs?: number;
  port?: number;
}

interface ToolsListResponse {
  result?: {
    tools?: Array<{ name: string }>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class IntegrationTester {
  private readonly exec: (command: string, options?: object) => Promise<{ stdout: string }>;
  private readonly spawn: typeof nodeSpawn;
  private readonly fetchFn: typeof fetch;
  private readonly startupWaitMs: number;
  private readonly port: number;

  public constructor(deps: IntegrationTesterDeps = {}) {
    this.exec =
      deps.exec ?? ((command, options) => execAsync(command, { windowsHide: true, ...options }));
    this.spawn = deps.spawn ?? nodeSpawn;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.startupWaitMs = deps.startupWaitMs ?? DEFAULT_STARTUP_WAIT_MS;
    this.port = deps.port ?? DEFAULT_MCP_PORT;
  }

  public async run(input: IntegrationTestInput): Promise<IntegrationTestReport> {
    try {
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
        MCP_BASE_URL: input.baseUrl,
        PORT: String(this.port)
      };
      serverProcess = this.spawn('node', ['dist/index.js'], {
        cwd: input.dir,
        env,
        windowsHide: true
      });
      serverProcess.stderr?.on('data', (chunk: Buffer | string) => {
        serverLogs.push(typeof chunk === 'string' ? chunk : chunk.toString());
      });

      await sleep(this.startupWaitMs);

      const listResponse = await this.fetchFn(`http://localhost:${this.port}/mcp/v1/tools/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      });

      if (!listResponse.ok) {
        throw new Error(`tools/list HTTP ${listResponse.status}`);
      }

      const listBody = (await listResponse.json()) as ToolsListResponse;
      const tools = listBody.result?.tools ?? [];
      const toolsCalled: string[] = [];

      if (tools.length > 0) {
        const firstTool = tools[0].name;

        try {
          const callResponse = await this.fetchFn(
            `http://localhost:${this.port}/mcp/v1/tools/call`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                  name: firstTool,
                  arguments: {}
                }
              })
            }
          );
          if (callResponse.ok) {
            toolsCalled.push(firstTool);
          }
        } catch {
          // Connectivity was already proven by tools/list.
        }
      }

      return {
        passed: true,
        toolsFound: tools.length,
        toolsCalled,
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
