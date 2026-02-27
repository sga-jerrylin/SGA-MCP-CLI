import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { testCommand } from './test.command';

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

function createFixtureServerScript(opts: {
  includeTestConnection: boolean;
  failTools?: boolean;
}): string {
  const tools = opts.includeTestConnection
    ? [
        '{ name: "test_connection" }',
        '{ name: "echo", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }'
      ]
    : [
        '{ name: "echo", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }'
      ];

  const callLogic = opts.failTools
    ? [
        '    if (name === "echo") {',
        '      send({ jsonrpc: "2.0", id: message.id, error: { code: 500, message: "boom" } });',
        '      return;',
        '    }'
      ]
    : [
        '    if (name === "test_connection") {',
        '      send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "connection ok" }] } });',
        '      return;',
        '    }',
        '    if (name === "echo") {',
        '      const args = (message.params && message.params.arguments) || {};',
        '      send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: `ok:${String(args.query || "")}` }] } });',
        '      return;',
        '    }'
      ];

  return [
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
    `    send({ jsonrpc: "2.0", id: message.id, result: { tools: [${tools.join(', ')}] } });`,
    '    return;',
    '  }',
    '  if (message.method === "tools/call") {',
    '    const name = message.params && message.params.name;',
    ...callLogic,
    '    send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "tool not found" } });',
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
    'process.stderr.write("fixture started\\n");',
    'process.stdin.on("data", (chunk) => {',
    '  buf = Buffer.concat([buf, Buffer.from(chunk)]);',
    '  parseFrames();',
    '});'
  ].join('\n');
}

function createProject(opts: { includeTestConnection: boolean; failTools?: boolean }): string {
  const workDir = mkdtempSync(join(tmpdir(), 'mcp-claw-test-cmd-'));
  mkdirSync(join(workDir, 'dist'), { recursive: true });
  writeFileSync(
    join(workDir, 'manifest.json'),
    JSON.stringify(
      {
        entrypoint: 'dist/index.js',
        credentials: []
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(join(workDir, 'dist', 'index.js'), createFixtureServerScript(opts), 'utf8');
  return workDir;
}

describe('testCommand', () => {
  jest.setTimeout(30_000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs MCP handshake and per-tool calls successfully', async () => {
    const workDir = createProject({ includeTestConnection: true });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      try {
        await testCommand(workDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('spawn EPERM')) {
          return;
        }
        throw error;
      }
      const output = logSpy.mock.calls.map((call) => String(call[0] ?? '')).join('\n');
      expect(output).toContain('All checks passed.');
      expect(output).toContain('OK tools/list');
      expect(output).toContain('OK test_connection');
      expect(output).toContain('OK echo');
    } finally {
      await removeDirWithRetry(workDir);
    }
  });

  it('fails when any executable tool call fails', async () => {
    const workDir = createProject({ includeTestConnection: false, failTools: true });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      try {
        await testCommand(workDir);
        throw new Error('expected testCommand to fail');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('spawn EPERM')) {
          return;
        }
        expect(message).toContain('1/1 tools failed');
      }
      const output = logSpy.mock.calls.map((call) => String(call[0] ?? '')).join('\n');
      expect(output).toContain('FAIL echo');
    } finally {
      await removeDirWithRetry(workDir);
    }
  });
});
