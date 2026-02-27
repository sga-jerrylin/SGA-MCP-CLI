import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { frameMcpMessage, IntegrationTester, parseMcpMessages } from './integration-tester';

function frame(message: object): Buffer {
  return Buffer.from(JSON.stringify(message) + '\n');
}

async function removeDirWithRetry(path: string): Promise<void> {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

describe('IntegrationTester', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('installs, builds, then runs initialize -> initialized -> tools/list over stdio', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const writes: Buffer[] = [];
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();

    const stdin = {
      write: jest.fn((chunk: Buffer) => {
        writes.push(Buffer.from(chunk));
        const payload = chunk.toString('utf8');

        if (payload.includes('"id":1') && payload.includes('"method":"initialize"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 1,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'demo', version: '1.0.0' }
              }
            })
          );
        }

        if (payload.includes('"id":2') && payload.includes('"method":"tools/list"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 2,
              result: {
                tools: [{ name: 'list_pets' }, { name: 'get_pet' }]
              }
            })
          );
        }

        if (payload.includes('"id":3') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 3,
              result: {
                ok: true
              }
            })
          );
        }

        if (payload.includes('"id":4') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 4,
              result: {
                ok: true
              }
            })
          );
        }

        if (payload.includes('"id":5') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 5,
              result: {
                ok: true
              }
            })
          );
        }

        return true;
      })
    };

    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });
    const mockSpawn = jest.fn().mockReturnValue(proc as never);

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: { API_KEY: 'test-key' }
    });

    expect(result.passed).toBe(true);
    expect(result.toolsFound).toBe(2);
    expect(result.allToolsPassed).toBe(true);
    expect(result.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'list_pets', ok: true }),
        expect.objectContaining({ name: 'get_pet', ok: true })
      ])
    );
    expect(result.toolsCalled).toEqual(['list_pets', 'list_pets', 'get_pet']);
    expect(mockExec).toHaveBeenNthCalledWith(
      1,
      'pnpm install',
      expect.objectContaining({ cwd: '/output/generated', timeout: 120_000 })
    );
    expect(mockExec).toHaveBeenNthCalledWith(
      2,
      'pnpm run build',
      expect.objectContaining({ cwd: '/output/generated', timeout: 120_000 })
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      'node',
      ['dist/index.js'],
      expect.objectContaining({
        cwd: '/output/generated',
        windowsHide: true
      })
    );
    expect(writes).toHaveLength(6);
    const sent = writes.map((buffer) => buffer.toString('utf8'));
    expect(sent[0]).toContain('"method":"initialize"');
    expect(sent[1]).toContain('"method":"notifications/initialized"');
    expect(sent[2]).toContain('"method":"tools/list"');
    expect(sent[3]).toContain('"method":"tools/call"');
    expect(sent[4]).toContain('"method":"tools/call"');
    expect(sent[5]).toContain('"method":"tools/call"');
    expect(result.authProbe).toMatchObject({
      authRequired: false,
      toolName: 'list_pets'
    });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('returns failed report if install or build fails', async () => {
    const mockExec = jest.fn().mockRejectedValueOnce(new Error('tsc error'));
    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: jest.fn() as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://x.com',
      authEnv: {}
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('tsc error');
  });

  it('returns useful diagnostics when server exits before initialize response', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();
    const stdin = { write: jest.fn(() => true) };

    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });

    const mockSpawn = jest.fn().mockImplementation(() => {
      process.nextTick(() => {
        stderr.emit('data', 'bootstrap failed');
        proc.emit('exit', 1, null);
      });
      return proc as never;
    });

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      startupWaitMs: 0,
      initializeTimeoutMs: 200,
      pollIntervalMs: 5
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: {}
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Server exited (code 1)');
    expect(result.error).toContain('bootstrap failed');
    expect(result.serverLog).toContain('bootstrap failed');
  });

  it('includes stderr diagnostics when initialize times out', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();
    const stdin = {
      write: jest.fn(() => true)
    };

    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });

    const mockSpawn = jest.fn().mockImplementation(() => {
      process.nextTick(() => {
        stderr.emit('data', 'waiting for credentials');
      });
      return proc as never;
    });

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      startupWaitMs: 0,
      initializeTimeoutMs: 120,
      pollIntervalMs: 5
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: {}
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('Timeout waiting for MCP response id=1');
    expect(result.error).toContain('waiting for credentials');
    expect(result.serverLog).toContain('waiting for credentials');
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('retries initialize using the configured protocol mode', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const writes: Buffer[] = [];
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();

    let initAttempt = 0;
    const stdin = {
      write: jest.fn((chunk: Buffer) => {
        writes.push(Buffer.from(chunk));
        const payload = chunk.toString('utf8');

        const isInit = payload.includes('"id":1') && payload.includes('"method":"initialize"');
        const isFramed = payload.toLowerCase().includes('content-length:');
        if (isInit && isFramed) {
          initAttempt += 1;
          if (initAttempt < 2) {
            return true;
          }
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 1,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'demo', version: '1.0.0' }
              }
            })
          );
        }

        if (payload.includes('"id":2') && payload.includes('"method":"tools/list"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 2,
              result: {
                tools: [{ name: 'echo' }]
              }
            })
          );
        }

        if (payload.includes('"id":3') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 3,
              result: { ok: true }
            })
          );
        }

        if (payload.includes('"id":4') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 4,
              result: { ok: true }
            })
          );
        }

        return true;
      })
    };

    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });
    const mockSpawn = jest.fn().mockReturnValue(proc as never);

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      protocolMode: 'framed',
      startupWaitMs: 0,
      initializeTimeoutMs: 3200,
      pollIntervalMs: 5
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: {}
    });

    expect(result.passed).toBe(true);
    const initWrites = writes.filter((chunk) => chunk.toString('utf8').includes('"id":1'));
    expect(initWrites.length).toBeGreaterThanOrEqual(2);
    expect(
      initWrites.every((chunk) => chunk.toString('utf8').toLowerCase().includes('content-length:'))
    ).toBe(true);
  });

  it('marks auth probe as required when first tool returns auth error', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const writes: Buffer[] = [];
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();
    const stdin = {
      write: jest.fn((chunk: Buffer) => {
        writes.push(Buffer.from(chunk));
        const payload = chunk.toString('utf8');

        if (payload.includes('"id":1') && payload.includes('"method":"initialize"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 1,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'demo', version: '1.0.0' }
              }
            })
          );
        }

        if (payload.includes('"id":2') && payload.includes('"method":"tools/list"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 2,
              result: {
                tools: [{ name: 'fetch_data' }]
              }
            })
          );
        }

        if (payload.includes('"id":3') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 3,
              error: {
                code: 401,
                message: 'Unauthorized: missing API key'
              }
            })
          );
        }

        if (payload.includes('"id":4') && payload.includes('"method":"tools/call"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 4,
              result: {
                ok: true
              }
            })
          );
        }

        return true;
      })
    };

    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });
    const mockSpawn = jest.fn().mockReturnValue(proc as never);

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: {}
    });

    expect(result.passed).toBe(true);
    expect(result.authProbe).toMatchObject({
      authRequired: true,
      toolName: 'fetch_data'
    });
    expect(result.authProbe?.authHint).toContain('401');
    expect(result.allToolsPassed).toBe(true);
  });

  it('parses MCP frames even when stdout has non-protocol prefix noise', () => {
    const noise = Buffer.from('boot log without newline');
    const message = frameMcpMessage({
      jsonrpc: '2.0',
      id: 1,
      result: { ok: true }
    });

    const parsed = parseMcpMessages(Buffer.concat([noise, message]));
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({ id: 1 });
    expect(parsed.rest.length).toBe(0);
  });

  it('parses Content-Length frames that use LF-only header delimiters', () => {
    const payload = Buffer.from(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        result: { ok: true }
      }),
      'utf8'
    );
    const frameLf = Buffer.concat([
      Buffer.from(`Content-Length: ${String(payload.length)}\n\n`, 'utf8'),
      payload
    ]);

    const parsed = parseMcpMessages(frameLf);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({ id: 9 });
    expect(parsed.rest.length).toBe(0);
  });

  it('works against a real spawned MCP stdio server using Content-Length framing', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'integration-tester-real-'));
    const distDir = join(projectDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    const entryFile = join(distDir, 'index.js');

    writeFileSync(
      entryFile,
      [
        "const { Buffer } = require('node:buffer');",
        'let buf = Buffer.alloc(0);',
        'function send(message) {',
        '  const payload = Buffer.from(JSON.stringify(message), "utf8");',
        '  process.stdout.write(`Content-Length: ${String(payload.length)}\\r\\n\\r\\n`);',
        '  process.stdout.write(payload);',
        '}',
        'function handle(message) {',
        '  if (!message || typeof message !== "object") return;',
        '  if (message.method === "initialize") {',
        '    send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1.0.0" } } });',
        '    return;',
        '  }',
        '  if (message.method === "tools/list") {',
        '    send({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "echo", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }] } });',
        '    return;',
        '  }',
        '  if (message.method === "tools/call") {',
        '    const args = (message.params && message.params.arguments) || {};',
        '    send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: `ok:${String(args.query || "")}` }] } });',
        '  }',
        '}',
        'function parseFrames() {',
        '  while (buf.length > 0) {',
        "    const headerEnd = buf.indexOf('\\r\\n\\r\\n');",
        '    if (headerEnd === -1) return;',
        '    const header = buf.subarray(0, headerEnd).toString("utf8");',
        '    const match = /content-length:\\s*(\\d+)/i.exec(header);',
        '    if (!match) return;',
        '    const length = Number(match[1]);',
        '    const frameEnd = headerEnd + 4 + length;',
        '    if (buf.length < frameEnd) return;',
        '    const body = buf.subarray(headerEnd + 4, frameEnd).toString("utf8");',
        '    buf = buf.subarray(frameEnd);',
        '    try {',
        '      handle(JSON.parse(body));',
        '    } catch {',
        '      // ignore malformed input',
        '    }',
        '  }',
        '}',
        'process.stdout.write("boot-noise");',
        'process.stderr.write("fixture started on stdio\\n");',
        'process.stdin.on("data", (chunk) => {',
        '  buf = Buffer.concat([buf, Buffer.from(chunk)]);',
        '  parseFrames();',
        '});'
      ].join('\n'),
      'utf8'
    );

    try {
      const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
      const tester = new IntegrationTester({
        exec: mockExec,
        protocolMode: 'framed',
        startupWaitMs: 300,
        initializeTimeoutMs: 5000,
        toolsListTimeoutMs: 3000,
        connectionTimeoutMs: 3000,
        pollIntervalMs: 10
      });

      const result = await tester.run({
        dir: projectDir,
        baseUrl: 'https://api.example.com',
        authEnv: {}
      });

      if (!result.passed && result.error?.includes('spawn EPERM')) {
        return;
      }

      if (!result.passed) {
        throw new Error(`real fixture failed: ${JSON.stringify(result)}`);
      }

      expect(result.passed).toBe(true);
      expect(result.toolsFound).toBe(1);
      expect(result.allToolsPassed).toBe(true);
      expect(result.toolResults).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'echo', ok: true })])
      );
      expect(result.serverLog).toContain('fixture started on stdio');
    } finally {
      await removeDirWithRetry(projectDir);
    }
  }, 20_000);
});
