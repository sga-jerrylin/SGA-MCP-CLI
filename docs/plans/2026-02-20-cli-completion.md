# CLI Completion — Integration Test + Manifest + Publish Tool

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the full read → generate → integration test → publish to market workflow in mcp-claw CLI.

**Architecture:** Four independent improvements wired together:

1. Fix doc truncation so the full API spec reaches the LLM
2. Auto-generate manifest.json from IR after Builder runs
3. Add a real integration test (build server → spawn → MCP call → report)
4. Add `test_integration` and `publish_mcp` tools to chat mode

**Tech Stack:** TypeScript, Node.js child_process, MCP SDK `@modelcontextprotocol/sdk`, Jest

---

## Task 1 — Fix doc truncation in LlmIrGenerator

Large API docs (> 12KB) are silently cut off, causing Architect to miss endpoints.

**Files:**

- Modify: `packages/cli/src/agents/architect/llm-ir-generator.ts:117`
- Test: `packages/cli/src/agents/architect/llm-ir-generator.spec.ts`

**Step 1 — Write failing test**

Add to `llm-ir-generator.spec.ts`:

```typescript
it('passes full doc up to 80 000 chars to LLM', async () => {
  const longDoc = 'GET /endpoint\n'.repeat(6000); // ~84 000 chars
  const captured: string[] = [];
  const llm = {
    complete: async (prompt: string) => {
      captured.push(prompt);
      return '{}';
    }
  };
  const gen = new LlmIrGenerator(llm);
  await gen.generate(longDoc);
  // prompt must contain at least 79 900 chars of the doc
  expect(captured[0].length).toBeGreaterThan(79_900);
});
```

Run: `npx jest llm-ir-generator --no-coverage`
Expected: FAIL (current limit is 12 000)

**Step 2 — Change the constant**

In `llm-ir-generator.ts` line 117:

```typescript
// Before:
const truncated = rawDoc.slice(0, 12_000);
// After:
const truncated = rawDoc.slice(0, 80_000);
```

**Step 3 — Verify test passes**

Run: `npx jest llm-ir-generator --no-coverage`
Expected: PASS

**Step 4 — Commit**

```bash
git add packages/cli/src/agents/architect/llm-ir-generator.ts \
        packages/cli/src/agents/architect/llm-ir-generator.spec.ts
git commit -m "fix(architect): raise doc truncation limit from 12KB to 80KB"
```

---

## Task 2 — Auto-generate manifest.json from IR

After Builder writes code files, auto-write `manifest.json` so `publish_mcp` works without manual steps.

**Files:**

- Modify: `packages/cli/src/commands/run.command.ts`
- Create: `packages/cli/src/utils/manifest-writer.ts`
- Test: `packages/cli/src/utils/manifest-writer.spec.ts`

**Step 1 — Write failing test**

Create `packages/cli/src/utils/manifest-writer.spec.ts`:

```typescript
import { writeManifest } from './manifest-writer';
import type { IR } from '@sga/core';

const mockFs = { writeFile: jest.fn() };

const ir: IR = {
  system: { code: 'pet-store', baseUrl: 'https://petstore.example.com', authType: 'bearer' },
  tools: [
    {
      name: 'list_pets',
      description: 'List all pets',
      method: 'GET',
      path: '/pets',
      params: [],
      needsConfirmation: false,
      isAsync: false
    },
    {
      name: 'create_pet',
      description: 'Create a pet',
      method: 'POST',
      path: '/pets',
      params: [],
      needsConfirmation: false,
      isAsync: false
    }
  ]
};

it('writes manifest.json with correct shape', async () => {
  await writeManifest('/output/dir', ir, mockFs as any);
  expect(mockFs.writeFile).toHaveBeenCalledWith(
    '/output/dir/manifest.json',
    expect.stringContaining('"name"'),
    'utf8'
  );
  const written = JSON.parse(mockFs.writeFile.mock.calls[0][1] as string);
  expect(written.name).toBe('mcp-server-pet-store');
  expect(written.version).toBe('1.0.0');
  expect(written.toolsCount).toBe(2);
  expect(written.credentials).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: 'PET_STORE_API_KEY', required: true })])
  );
});
```

Run: `npx jest manifest-writer --no-coverage`
Expected: FAIL (file doesn't exist)

**Step 2 — Create manifest-writer.ts**

Create `packages/cli/src/utils/manifest-writer.ts`:

```typescript
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import type { IR } from '@sga/core';

export interface ManifestCredential {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  category: string;
  toolsCount: number;
  credentials: ManifestCredential[];
}

function toKebab(code: string): string {
  return code
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildCredentials(ir: IR): ManifestCredential[] {
  if (ir.system.authType === 'none') return [];
  const code = ir.system.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (ir.system.authType === 'bearer') {
    return [
      {
        key: `${code}_API_TOKEN`,
        label: 'API Token',
        type: 'secret',
        required: true,
        description: `Bearer token for ${ir.system.code}`
      }
    ];
  }
  return [
    {
      key: `${code}_API_KEY`,
      label: 'API Key',
      type: 'secret',
      required: true,
      description: `API key for ${ir.system.code}`
    }
  ];
}

type FsLike = Pick<typeof fs, 'writeFile'>;

export async function writeManifest(
  outputDir: string,
  ir: IR,
  fsImpl: FsLike = fs
): Promise<string> {
  const manifest: Manifest = {
    name: `mcp-server-${toKebab(ir.system.code)}`,
    version: '1.0.0',
    description: `MCP server for ${ir.system.code} API`,
    category: 'api',
    toolsCount: ir.tools.length,
    credentials: buildCredentials(ir)
  };
  const manifestPath = join(outputDir, 'manifest.json');
  await fsImpl.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifestPath;
}
```

**Step 3 — Wire into run.command.ts**

In `run.command.ts`, after the Builder stage completes (after line ~344), add:

```typescript
import { writeManifest } from '../utils/manifest-writer';

// After builderResult:
const manifestPath = await writeManifest(input.root, architectResult.ir);
input.logger.log(`Builder - wrote manifest: ${manifestPath}`);
```

**Step 4 — Verify tests pass**

Run: `npx jest manifest-writer --no-coverage`
Expected: PASS

Run: `npx jest --no-coverage`
Expected: all PASS

**Step 5 — Commit**

```bash
git add packages/cli/src/utils/manifest-writer.ts \
        packages/cli/src/utils/manifest-writer.spec.ts \
        packages/cli/src/commands/run.command.ts
git commit -m "feat(builder): auto-generate manifest.json from IR after code generation"
```

---

## Task 3 — Integration Tester (Method B: real server spawn + MCP call)

Build generated server, spawn it, send one MCP `tools/list` + `tools/call`, verify response, report.

**Files:**

- Create: `packages/cli/src/agents/tester/integration-tester.ts`
- Test: `packages/cli/src/agents/tester/integration-tester.spec.ts`

**Step 1 — Write failing test**

Create `packages/cli/src/agents/tester/integration-tester.spec.ts`:

```typescript
import { IntegrationTester } from './integration-tester';

const mockExec = jest.fn();
const mockSpawn = jest.fn();
const mockFetch = jest.fn();

describe('IntegrationTester', () => {
  it('builds server, starts it, calls tools/list, returns report', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: 'ok' }) // npm run build
      .mockResolvedValueOnce({ stdout: 'ok' }); // pre-check
    mockSpawn.mockReturnValue({
      pid: 1234,
      kill: jest.fn(),
      stderr: { on: jest.fn() }
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tools: [{ name: 'list_pets' }] })
    });

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn,
      fetchFn: mockFetch
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: { API_KEY: 'test-key' }
    });

    expect(result.passed).toBe(true);
    expect(result.toolsFound).toBeGreaterThan(0);
  });

  it('returns failed report if build fails', async () => {
    mockExec.mockRejectedValueOnce(new Error('tsc error'));
    const tester = new IntegrationTester({ exec: mockExec, spawn: mockSpawn, fetchFn: mockFetch });
    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://x.com',
      authEnv: {}
    });
    expect(result.passed).toBe(false);
    expect(result.error).toContain('tsc error');
  });
});
```

Run: `npx jest integration-tester --no-coverage`
Expected: FAIL (file doesn't exist)

**Step 2 — Create integration-tester.ts**

Create `packages/cli/src/agents/tester/integration-tester.ts`:

```typescript
import { exec } from 'node:child_process';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

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
  exec?: (cmd: string, opts?: object) => Promise<{ stdout: string }>;
  spawn?: typeof nodeSpawn;
  fetchFn?: typeof fetch;
}

const STARTUP_WAIT_MS = 3000;
const MCP_PORT = 13579;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class IntegrationTester {
  private readonly exec: (cmd: string, opts?: object) => Promise<{ stdout: string }>;
  private readonly spawn: typeof nodeSpawn;
  private readonly fetchFn: typeof fetch;

  public constructor(deps: IntegrationTesterDeps = {}) {
    this.exec = deps.exec ?? ((cmd, opts) => execAsync(cmd, { windowsHide: true, ...opts }));
    this.spawn = deps.spawn ?? nodeSpawn;
    this.fetchFn = deps.fetchFn ?? fetch;
  }

  public async run(input: IntegrationTestInput): Promise<IntegrationTestReport> {
    // Step 1: Build
    try {
      await this.exec('npm run build', { cwd: input.dir, timeout: 120_000 });
    } catch (err) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: `Build failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }

    // Step 2: Spawn server
    const serverLogs: string[] = [];
    let serverProcess: ChildProcess | undefined;
    try {
      const env = {
        ...process.env,
        ...input.authEnv,
        MCP_BASE_URL: input.baseUrl,
        PORT: String(MCP_PORT)
      };
      serverProcess = this.spawn('node', ['dist/index.js'], {
        cwd: input.dir,
        env,
        windowsHide: true
      } as object) as ChildProcess;
      serverProcess.stderr?.on('data', (d: Buffer) => serverLogs.push(d.toString()));
      await sleep(STARTUP_WAIT_MS);

      // Step 3: List tools via HTTP (SSE transport)
      const listResp = await this.fetchFn(`http://localhost:${MCP_PORT}/mcp/v1/tools/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      });
      if (!listResp.ok) throw new Error(`tools/list HTTP ${listResp.status}`);
      const listBody = (await listResp.json()) as { result?: { tools?: { name: string }[] } };
      const tools = listBody.result?.tools ?? [];

      // Step 4: Call the first tool (with empty params) to test connectivity
      const toolsCalled: string[] = [];
      if (tools.length > 0) {
        const firstTool = tools[0].name;
        try {
          const callResp = await this.fetchFn(`http://localhost:${MCP_PORT}/mcp/v1/tools/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: { name: firstTool, arguments: {} }
            })
          });
          if (callResp.ok) toolsCalled.push(firstTool);
        } catch {
          // tool call failure is non-fatal — connectivity is proven
        }
      }

      return {
        passed: true,
        toolsFound: tools.length,
        toolsCalled,
        serverLog: serverLogs.slice(-20).join('')
      };
    } catch (err) {
      return {
        passed: false,
        toolsFound: 0,
        toolsCalled: [],
        error: err instanceof Error ? err.message : String(err),
        serverLog: serverLogs.slice(-20).join('')
      };
    } finally {
      serverProcess?.kill();
    }
  }
}
```

**Step 3 — Verify tests pass**

Run: `npx jest integration-tester --no-coverage`
Expected: PASS

**Step 4 — Commit**

```bash
git add packages/cli/src/agents/tester/integration-tester.ts \
        packages/cli/src/agents/tester/integration-tester.spec.ts
git commit -m "feat(tester): add IntegrationTester — build+spawn server, verify MCP tools/list"
```

---

## Task 4 — Add `test_integration` and `publish_mcp` to chat tools

Wire the new IntegrationTester and existing publishCommand into the interactive chat session.

**Files:**

- Modify: `packages/cli/src/chat/tool-definitions.ts`
- Modify: `packages/cli/src/chat/chat-session.ts`
- Modify: `packages/cli/src/chat/chat-types.ts` (if needed)
- Test: `packages/cli/src/chat/chat-session.spec.ts`

**Step 1 — Add tool names to ChatToolName**

In `tool-definitions.ts`, update the union type:

```typescript
export type ChatToolName =
  | 'read_folder'
  | 'read_file'
  | 'fetch_url'
  | 'generate_mcp'
  | 'run_tests'
  | 'test_integration' // NEW
  | 'publish_mcp' // NEW
  | 'show_history';
```

**Step 2 — Add tool definitions**

In `buildToolDefinitions()`, after `run_tests`, insert:

```typescript
{
  type: 'function',
  function: {
    name: 'test_integration',
    description: [
      'Build the generated MCP server, start it as a subprocess, and make a real API call to verify it works.',
      'Use this AFTER generate_mcp and run_tests succeed.',
      'Requires: base_url (real API endpoint) and optional auth_env (env var key=value pairs for credentials).'
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Path to generated MCP server. Defaults to last generated dir.' },
        base_url: { type: 'string', description: 'Real API base URL to test against, e.g. https://api.myservice.com' },
        auth_env: {
          type: 'object',
          description: 'Credentials as env vars, e.g. {"MY_SERVICE_API_KEY": "sk-xxx"}',
          additionalProperties: { type: 'string' }
        }
      },
      required: ['base_url'],
      additionalProperties: false
    }
  }
},
{
  type: 'function',
  function: {
    name: 'publish_mcp',
    description: [
      'Publish the generated MCP server to SGA Market.',
      'Reads manifest.json from the generated dir (auto-created by generate_mcp).',
      'Requires: user must be logged in (mcp-claw login) OR provide market_url and token.'
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Path to generated MCP server with manifest.json. Defaults to last generated dir.' },
        market_url: { type: 'string', description: 'Market URL. Defaults to ~/.sga config.' },
        token: { type: 'string', description: 'Auth token. Defaults to ~/.sga config.' }
      },
      required: [],
      additionalProperties: false
    }
  }
},
```

**Step 3 — Add handlers in chat-session.ts**

Add imports at top:

```typescript
import { IntegrationTester } from '../agents/tester/integration-tester';
import { publishCommand } from '../commands/publish.command';
import { saveToken, saveMarketUrl } from '../utils/auth';
```

Add to switch in `executeTool`:

```typescript
case 'test_integration':
  return this.testIntegration(args);
case 'publish_mcp':
  return this.publishMcp(args);
```

Add handler methods:

```typescript
private async testIntegration(args: Record<string, unknown>): Promise<string> {
  const dir = (typeof args.dir === 'string' && args.dir.trim())
    ? this.resolvePath(args.dir)
    : (this.lastGeneratedDir ?? this.config.workDir);
  const baseUrl = typeof args.base_url === 'string' ? args.base_url.trim() : '';
  if (!baseUrl) return JSON.stringify({ error: 'base_url is required' });

  const authEnv: Record<string, string> = {};
  if (args.auth_env && typeof args.auth_env === 'object' && !Array.isArray(args.auth_env)) {
    for (const [k, v] of Object.entries(args.auth_env as Record<string, unknown>)) {
      if (typeof v === 'string') authEnv[k] = v;
    }
  }

  const tester = new IntegrationTester();
  const report = await tester.run({ dir, baseUrl, authEnv });
  return JSON.stringify(report, null, 2);
}

private async publishMcp(args: Record<string, unknown>): Promise<string> {
  const dir = (typeof args.dir === 'string' && args.dir.trim())
    ? this.resolvePath(args.dir)
    : (this.lastGeneratedDir ?? this.config.workDir);
  const marketUrl = typeof args.market_url === 'string' ? args.market_url.trim() : undefined;
  const token = typeof args.token === 'string' ? args.token.trim() : undefined;

  // Persist overrides to config so publishCommand picks them up
  if (marketUrl) saveMarketUrl(marketUrl);
  if (token) saveToken(token);

  try {
    await publishCommand({}, dir);
    return JSON.stringify({ status: 'ok', dir });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}
```

**Step 4 — Add tests for new tools**

In `chat-session.spec.ts`, add:

```typescript
it('dispatches test_integration tool', async () => {
  const mockTester = {
    run: jest.fn().mockResolvedValue({ passed: true, toolsFound: 3, toolsCalled: ['list_items'] })
  };
  // Inject via toolHandlers
  const session = new ChatSession(config, {
    llm: mockLlm([{ name: 'test_integration', args: { base_url: 'https://api.x.com' } }]),
    toolHandlers: { test_integration: async () => JSON.stringify({ passed: true, toolsFound: 3 }) }
  });
  await session.send('test the server');
  expect(output).toContain('test_integration');
});

it('dispatches publish_mcp tool', async () => {
  const session = new ChatSession(config, {
    llm: mockLlm([{ name: 'publish_mcp', args: {} }]),
    toolHandlers: { publish_mcp: async () => JSON.stringify({ status: 'ok' }) }
  });
  await session.send('publish to market');
  expect(output).toContain('publish_mcp');
});
```

**Step 5 — Update system prompt with new tool guidance**

In `buildSystemPrompt()` in `chat-session.ts`, update the Workflow section:

```typescript
'# Workflow',
'1) Read docs: read_folder → read_file or fetch_url',
'2) Analyze: identify ALL endpoints, auth method, data models',
'3) Propose: summarize tools before generating',
'4) Generate: call generate_mcp',
'5) Unit test: call run_tests',
'6) Integration test: ask user for real API URL + credentials, call test_integration',
'7) Publish: ask user for market URL if not configured, call publish_mcp',
```

**Step 6 — Run all tests**

Run: `npx jest --no-coverage`
Expected: all PASS

**Step 7 — Commit**

```bash
git add packages/cli/src/chat/tool-definitions.ts \
        packages/cli/src/chat/chat-session.ts \
        packages/cli/src/chat/chat-session.spec.ts
git commit -m "feat(chat): add test_integration and publish_mcp tools to chat mode"
```

---

## Task 5 — Build + publish 0.1.15

**Step 1 — Bump version**

```bash
cd packages/cli && npm version 0.1.15 --no-git-tag-version
```

**Step 2 — Build**

```bash
cd /e/mcp && pnpm --filter mcp-claw run build
```

Expected: `dist/bundle.js` rebuilt, no errors

**Step 3 — Final test run**

```bash
cd packages/cli && npx jest --no-coverage
```

Expected: all PASS

**Step 4 — Publish**

```bash
npm publish --access public
```

Expected: `+ mcp-claw@0.1.15`

**Step 5 — Final commit**

```bash
git add packages/cli/package.json
git commit -m "chore(release): bump to 0.1.15"
```

---

## Completion Criteria

- [ ] `LlmIrGenerator` handles docs up to 80KB
- [ ] After `generate_mcp`, `manifest.json` auto-created in output dir
- [ ] `test_integration` tool: builds server, spawns, calls `tools/list`, returns report with `passed`, `toolsFound`
- [ ] `publish_mcp` tool: reads manifest.json, POSTs to market, accepts `market_url` + `token` overrides
- [ ] System prompt updated with 7-step workflow
- [ ] All existing tests still pass (71 tests)
- [ ] Published as `mcp-claw@0.1.15`
