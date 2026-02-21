# SGA CLI Vertical Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `@sga/cli` into a working "source → MCP server → market" pipeline: give it a folder or URL, it auto-analyzes, generates a fastmcp-compatible MCP server, tests it, and optionally publishes.

**Architecture:** Thin orchestrator pattern — CLI wires together existing tools (Playwright for web, pdf-parse for PDFs, OpenRouter LLM for semantics) rather than reimplementing them. Five-agent pipeline (Explorer → Architect → Builder → Tester → Publisher) is connected end-to-end through the `generate` command. Config lives in `~/.sga/config.yaml`.

**Tech Stack:** TypeScript, Commander.js, ora (spinners), chalk, playwright (browser), pdf-parse (PDFs), @sga/core (IR + codegen), OpenRouter (LLM via existing llm-client.ts)

---

## Phase A — Wire the Pipeline (most critical, nothing works without this)

### Task 1: Connect `run.command.ts` to the actual agent pipeline

**Files:**

- Modify: `packages/cli/src/commands/run.command.ts`
- Modify: `packages/cli/src/commands/run.command.ts` (add pipeline runner)

**Context:**
Currently `runCommand` just creates a reporter and sends a "done" event — no agents are called at all. We need to wire: ExplorerAgent → ArchitectAgent → BuilderAgent → TesterAgent.

The agents exist but take specific deps:

```typescript
// ExplorerAgent needs: { fsTool, dockerTool, httpTool }
// ArchitectAgent needs: no deps (uses @sga/core directly)
// BuilderAgent needs: { adapter: CoreCodegenAdapter, installer: DependencyInstaller }
// TesterAgent needs: { sandboxAdapter, runner }
```

**Step 1: Write failing integration test**

Create `packages/cli/src/commands/run.command.spec.ts`:

```typescript
import { runCommand } from './run.command';

it('runs pipeline and returns artifact', async () => {
  const logs: string[] = [];
  await runCommand({
    root: __dirname + '/../../fixtures/sample-api',
    logger: { log: (m: string) => logs.push(m) }
  });
  expect(logs.some((m) => m.includes('Explorer'))).toBe(true);
  expect(logs.some((m) => m.includes('Builder'))).toBe(true);
});
```

Create fixture `packages/cli/src/fixtures/sample-api/README.md`:

```markdown
# Sample API

GET /users - list users
GET /users/:id - get user by id
POST /users - create user
```

**Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx jest run.command.spec --no-coverage
```

Expected: FAIL — logs array is empty

**Step 3: Implement pipeline wiring in run.command.ts**

Replace the empty try block with:

```typescript
import { ExplorerAgent } from '../agents/explorer/explorer.agent';
import { ArchitectAgent } from '../agents/architect/architect.agent';
import { BuilderAgent } from '../agents/builder/builder.agent';
import { CoreCodegenAdapter } from '../agents/builder/core-codegen.adapter';
import { DependencyInstaller } from '../agents/builder/dependency-installer';
import { TesterAgent } from '../agents/tester/tester.agent';
import { TesterSandboxAdapter } from '../agents/tester/sandbox.adapter';
import { TestRunner } from '../agents/tester/test-runner';
import { McpClawCore } from '@sga/core';
import { OpenRouterProvider } from '../llm/llm-client';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvConfig(root: string) {
  // search upward for .env
  let dir = resolve(root);
  for (let i = 0; i < 5; i++) {
    const p = resolve(dir, '.env');
    if (existsSync(p)) {
      const text = readFileSync(p, 'utf8');
      const map = new Map<string, string>();
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) map.set(m[1], m[2]);
      }
      return map;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return new Map<string, string>();
}

// Inside runCommand, replace the empty try block:
const env = loadEnvConfig(input.root);
const apiKey = env.get('OPENROUTER_API_KEY') ?? process.env.OPENROUTER_API_KEY ?? '';
const coderModel = env.get('LLM_CODER_MODEL') ?? 'anthropic/claude-sonnet-4.5';
const baseUrl = env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

// 1. Explorer
input.logger.log('Explorer — scanning sources...');
const explorer = new ExplorerAgent();
const explorerReport = await explorer.run({ root: input.root, urls: [] });

// 2. Architect
input.logger.log('Architect — designing MCP tools...');
const architect = new ArchitectAgent();
const architectResult = await architect.run(explorerReport);

// 3. Builder
input.logger.log('Builder — generating code...');
const llmProvider = new OpenRouterProvider('coder', coderModel, apiKey, baseUrl);
const core = new McpClawCore(llmProvider);
const adapter = new CoreCodegenAdapter(core);
const installer = new DependencyInstaller();
const builder = new BuilderAgent({ adapter, installer });
const builderResult = await builder.run({
  root: input.root,
  planDoc: JSON.stringify(architectResult.ir)
});

// 4. Tester
input.logger.log('Tester — validating generated server...');
const tester = new TesterAgent({
  sandboxAdapter: new TesterSandboxAdapter(),
  runner: new TestRunner()
});
const testerResult = await tester.run({
  root: input.root,
  files: builderResult.writtenFiles.map((p) => ({ path: p, content: '' }))
});

input.logger.log(
  `Done — ${testerResult.passed ? 'PASS' : 'FAIL'} (${builderResult.writtenFiles.length} files written)`
);
```

**Step 4: Run test**

```bash
cd packages/cli && npx jest run.command.spec --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/run.command.ts packages/cli/src/commands/run.command.spec.ts packages/cli/src/fixtures/
git commit -m "feat(cli): wire run command to full Explorer→Builder→Tester pipeline"
```

---

### Task 2: Add `sga generate <source>` command

**Files:**

- Create: `packages/cli/src/commands/generate.command.ts`
- Modify: `packages/cli/src/cli.ts`

**Context:**
The new command is `sga generate <source>` where `<source>` is a local path or URL. It calls the same pipeline as `run` but accepts a URL as first-class input and shows progress with ora.

**Step 1: Write failing test**

```typescript
// packages/cli/src/commands/generate.command.spec.ts
import { generateCommand } from './generate.command';

it('accepts a local path', async () => {
  const logs: string[] = [];
  await generateCommand({
    source: __dirname + '/../../fixtures/sample-api',
    logger: { log: (m: string) => logs.push(m) }
  });
  expect(logs.length).toBeGreaterThan(0);
});

it('accepts a URL source', async () => {
  const logs: string[] = [];
  await generateCommand({
    source: 'https://example.com',
    logger: { log: (m: string) => logs.push(m) },
    dryRun: true // skip network in test
  });
  expect(logs.length).toBeGreaterThan(0);
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest generate.command.spec --no-coverage
```

Expected: FAIL — module not found

**Step 3: Implement generate.command.ts**

```typescript
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runCommand } from './run.command';

export interface GenerateCommandInput {
  source: string; // path or URL
  output?: string; // output dir, defaults to source dir
  publish?: boolean; // auto-publish after success
  dryRun?: boolean; // skip network calls (testing)
  logger?: Pick<Console, 'log'>;
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export async function generateCommand(input: GenerateCommandInput): Promise<void> {
  const logger = input.logger ?? console;
  const source = input.source;

  let root: string;
  let urls: string[] = [];

  if (isUrl(source)) {
    // URL mode: use a temp or cwd-relative output dir
    root = input.output ?? resolve(process.cwd(), 'generated-mcp');
    urls = [source];
    logger.log(`Source: URL → ${source}`);
  } else {
    root = resolve(source);
    if (!existsSync(root)) {
      throw new Error(`Source path not found: ${root}`);
    }
    logger.log(`Source: folder → ${root}`);
  }

  await runCommand({ root, urls, logger, dryRun: input.dryRun });

  if (input.publish) {
    logger.log('Publishing to SGA market...');
    // TODO: Task 12 — publish after test pass
  }
}
```

Also update `runCommand` signature to accept optional `urls` and `dryRun` params and pass `urls` to `ExplorerAgent`.

**Step 4: Register in cli.ts**

```typescript
import { generateCommand } from './commands/generate.command';

program
  .command('generate <source>')
  .description('Generate an MCP server from a folder or URL')
  .option('-o, --output <dir>', 'Output directory')
  .option('--publish', 'Auto-publish after successful test')
  .action(async (source: string, options: { output?: string; publish?: boolean }) => {
    await generateCommand({ source, output: options.output, publish: options.publish });
  });
```

**Step 5: Run tests**

```bash
cd packages/cli && npx jest generate.command.spec --no-coverage
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/cli/src/commands/generate.command.ts packages/cli/src/commands/generate.command.spec.ts packages/cli/src/cli.ts
git commit -m "feat(cli): add sga generate <source> command"
```

---

### Task 3: Rename binary from `mcp-claw` to `sga`

**Files:**

- Modify: `packages/cli/src/cli.ts` (program.name)
- Modify: `packages/cli/package.json` (bin field)

**Step 1: Update cli.ts**

```typescript
program.name('sga').description('SGA — MCP Server Generator').version('0.2.0');
```

**Step 2: Update package.json bin**

```json
"bin": {
  "sga": "./dist/index.js",
  "mcp-claw": "./dist/index.js"
}
```

Keep `mcp-claw` as an alias for backward compat.

**Step 3: Build and verify**

```bash
cd packages/cli && pnpm build && node dist/index.js --help
```

Expected: Shows `sga` in usage line

**Step 4: Commit**

```bash
git add packages/cli/package.json packages/cli/src/cli.ts
git commit -m "chore(cli): rename binary to sga, keep mcp-claw alias"
```

---

## Phase B — Smart Explorer (URL + PDF)

### Task 4: Add BrowserTool (Playwright web scraping)

**Files:**

- Create: `packages/cli/src/tools/browser-tool.ts`
- Create: `packages/cli/src/tools/browser-tool.spec.ts`

**Context:**
We need to fetch rendered web pages (not just raw HTTP) so we can read JavaScript-rendered API docs. Use `playwright` in headless mode. This is NOT a playwright-mcp integration — it's a direct Playwright call, which is simpler and has no external dependency.

Install: `pnpm add playwright --filter @sga/cli`
Then: `npx playwright install chromium --with-deps`

**Step 1: Write failing test**

```typescript
// packages/cli/src/tools/browser-tool.spec.ts
import { BrowserTool } from './browser-tool';

describe('BrowserTool', () => {
  it('extracts text content from a URL', async () => {
    const tool = new BrowserTool();
    // Use a mock/stub so tests don't need network
    const mockPage = {
      goto: jest.fn().mockResolvedValue(null),
      content: jest.fn().mockResolvedValue('<html><body><h1>API Docs</h1></body></html>'),
      evaluate: jest.fn().mockResolvedValue('API Docs'),
      close: jest.fn().mockResolvedValue(null)
    };
    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(null)
    };
    jest.spyOn(tool as any, 'launchBrowser').mockResolvedValue(mockBrowser);

    const result = await tool.fetch('https://example.com/api');
    expect(result.url).toBe('https://example.com/api');
    expect(result.text).toContain('API Docs');
    expect(result.html.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest browser-tool.spec --no-coverage
```

Expected: FAIL

**Step 3: Implement browser-tool.ts**

```typescript
import { chromium, type Browser } from 'playwright';

export interface BrowserFetchResult {
  url: string;
  html: string;
  text: string;
  title: string;
  links: string[];
  openApiUrls: string[]; // detected OpenAPI spec links
}

export class BrowserTool {
  // protected so tests can spy on it
  protected async launchBrowser(): Promise<Browser> {
    return chromium.launch({ headless: true });
  }

  public async fetch(url: string, timeoutMs = 30_000): Promise<BrowserFetchResult> {
    const browser = await this.launchBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

      const html = await page.content();
      const title = await page.title();

      // Extract visible text
      const text = await page.evaluate(() => {
        const body = document.body;
        // remove script/style
        const scripts = body.querySelectorAll('script, style, nav, header, footer');
        scripts.forEach((el) => el.remove());
        return body.innerText ?? body.textContent ?? '';
      });

      // Extract links
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith('http'))
          .slice(0, 50)
      );

      // Detect OpenAPI spec links
      const openApiUrls = links.filter((l) =>
        /openapi|swagger|api-docs|api\.json|api\.yaml/i.test(l)
      );

      return { url, html, text: text.trim(), title, links, openApiUrls };
    } finally {
      await page.close();
      await browser.close();
    }
  }
}
```

**Step 4: Run tests**

```bash
cd packages/cli && npx jest browser-tool.spec --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/tools/browser-tool.ts packages/cli/src/tools/browser-tool.spec.ts
git commit -m "feat(cli): add BrowserTool with Playwright headless browser"
```

---

### Task 5: Add PdfTool

**Files:**

- Create: `packages/cli/src/tools/pdf-tool.ts`
- Create: `packages/cli/src/tools/pdf-tool.spec.ts`

Install: `pnpm add pdf-parse --filter @sga/cli && pnpm add -D @types/pdf-parse --filter @sga/cli`

**Step 1: Write failing test**

```typescript
// packages/cli/src/tools/pdf-tool.spec.ts
import { PdfTool } from './pdf-tool';
import { join } from 'node:path';

it('extracts text from PDF buffer', async () => {
  const tool = new PdfTool();
  // mock pdf-parse
  jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'API endpoint: GET /users' }));
  const buf = Buffer.from('fake-pdf');
  const result = await tool.extractFromBuffer(buf);
  expect(result.text).toContain('GET /users');
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest pdf-tool.spec --no-coverage
```

**Step 3: Implement pdf-tool.ts**

```typescript
import { readFile } from 'node:fs/promises';
import pdfParse from 'pdf-parse';

export interface PdfExtractResult {
  text: string;
  pages: number;
  info: Record<string, unknown>;
}

export class PdfTool {
  public async extractFromFile(filePath: string): Promise<PdfExtractResult> {
    const buf = await readFile(filePath);
    return this.extractFromBuffer(buf);
  }

  public async extractFromBuffer(buffer: Buffer): Promise<PdfExtractResult> {
    const result = await pdfParse(buffer);
    return {
      text: result.text,
      pages: result.numpages,
      info: result.info as Record<string, unknown>
    };
  }
}
```

**Step 4: Run tests**

```bash
cd packages/cli && npx jest pdf-tool.spec --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/tools/pdf-tool.ts packages/cli/src/tools/pdf-tool.spec.ts
git commit -m "feat(cli): add PdfTool using pdf-parse"
```

---

### Task 6: Update Explorer to use BrowserTool + PdfTool

**Files:**

- Modify: `packages/cli/src/agents/explorer/explorer.agent.ts`
- Modify: `packages/cli/src/agents/explorer/explorer.agent.spec.ts`

**Context:**
Currently Explorer only globs local files + fetches raw HTTP. We need to:

1. Detect if a URL is given → use BrowserTool instead of HttpFetchTool
2. Find `.pdf` files in glob results → use PdfTool to extract text
3. Add `rawDocs: string[]` to `ExplorerReport` so Architect can read human text

**Step 1: Update spec**

Add to existing spec:

```typescript
it('uses BrowserTool for URLs', async () => {
  const mockBrowser = {
    fetch: jest
      .fn()
      .mockResolvedValue({
        url: 'https://api.example.com',
        text: 'GET /users',
        html: '',
        title: '',
        links: [],
        openApiUrls: []
      })
  };
  const agent = new ExplorerAgent({ ...defaultDeps, browserTool: mockBrowser });
  const report = await agent.run({ root: '/tmp', urls: ['https://api.example.com'] });
  expect(mockBrowser.fetch).toHaveBeenCalledWith('https://api.example.com');
  expect(report.rawDocs).toContain('GET /users');
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest explorer.agent.spec --no-coverage
```

**Step 3: Update explorer.agent.ts**

```typescript
import { BrowserTool, type BrowserFetchResult } from '../../tools/browser-tool';
import { PdfTool } from '../../tools/pdf-tool';

export interface ExplorerReport {
  files: string[];
  containers: DockerContainerInfo[];
  endpoints: HttpFetchResult[];
  browserPages: BrowserFetchResult[]; // new
  rawDocs: string[]; // new: all human-readable text collected
}

export interface ExplorerDeps {
  fsTool: Pick<FsTool, 'glob'>;
  dockerTool: Pick<DockerInspectTool, 'listContainers'>;
  httpTool: Pick<HttpFetchTool, 'fetch'>;
  browserTool?: Pick<BrowserTool, 'fetch'>; // optional, skipped in tests
  pdfTool?: Pick<PdfTool, 'extractFromFile'>; // optional
}

// In run():
// 1. For each URL: try browser first, fall back to http
// 2. For *.pdf files found by glob: extract text
// 3. Aggregate all text into rawDocs
```

**Step 4: Run tests**

```bash
cd packages/cli && npx jest explorer.agent.spec --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/agents/explorer/
git commit -m "feat(explorer): add browser + PDF support, expose rawDocs"
```

---

## Phase C — LLM-Powered Architect

### Task 7: Replace naive IR generator with LLM-based semantic understanding

**Files:**

- Create: `packages/cli/src/agents/architect/llm-ir-generator.ts`
- Create: `packages/cli/src/agents/architect/llm-ir-generator.spec.ts`
- Modify: `packages/cli/src/agents/architect/architect.agent.ts`

**Context:**
Current `buildIRFromDiscovery` just converts URL path strings to tool names — it does zero semantic understanding. We need to pass the `rawDocs` text from Explorer to an LLM and ask it to extract a proper IR (tools with names, descriptions, params).

**Step 1: Write failing test**

```typescript
// packages/cli/src/agents/architect/llm-ir-generator.spec.ts
import { LlmIrGenerator } from './llm-ir-generator';

it('extracts tools from raw doc text', async () => {
  const mockLlm = {
    complete: jest.fn().mockResolvedValue(
      JSON.stringify({
        system: { code: 'github-api', baseUrl: 'https://api.github.com', authType: 'bearer' },
        tools: [
          {
            name: 'list_repos',
            description: 'List repositories',
            method: 'GET',
            path: '/user/repos',
            params: [],
            needsConfirmation: false,
            isAsync: false
          }
        ]
      })
    )
  };
  const gen = new LlmIrGenerator(mockLlm);
  const ir = await gen.generate('GET /user/repos - list repositories for the authenticated user');
  expect(ir.tools[0].name).toBe('list_repos');
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest llm-ir-generator.spec --no-coverage
```

**Step 3: Implement llm-ir-generator.ts**

````typescript
import type { IR } from '@sga/core';
import type { LlmProvider } from '../../llm/llm-client';

const SYSTEM_PROMPT = `You are an API analyzer. Given documentation text, extract an MCP server IR.
Return ONLY a JSON object (no markdown, no explanation) with this shape:
{
  "system": { "code": "...", "baseUrl": "...", "authType": "none|bearer|api-key" },
  "tools": [{ "name": "snake_case_name", "description": "...", "method": "GET|POST|PUT|DELETE", "path": "/...", "params": [], "needsConfirmation": false, "isAsync": false }]
}
Rules:
- tool names must be snake_case
- extract every distinct API endpoint as one tool
- if no endpoints found, infer from context
- baseUrl: use the API base URL or "https://api.example.com"`;

export class LlmIrGenerator {
  public constructor(private readonly llm: Pick<LlmProvider, 'complete'>) {}

  public async generate(rawDoc: string): Promise<IR> {
    const prompt = `${SYSTEM_PROMPT}\n\nDocumentation:\n${rawDoc.slice(0, 12_000)}`;
    const raw = await this.llm.complete(prompt);

    // strip markdown fences if LLM wraps in ```json
    const cleaned = raw
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    try {
      return JSON.parse(cleaned) as IR;
    } catch {
      // fallback: return empty IR
      return {
        system: { code: 'unknown', baseUrl: 'https://api.example.com', authType: 'none' },
        tools: []
      };
    }
  }
}
````

**Step 4: Wire into ArchitectAgent**

```typescript
// architect.agent.ts — add optional llm dep:
export interface ArchitectDeps {
  llmIrGenerator?: Pick<LlmIrGenerator, 'generate'>;
}

// In run(): if rawDocs available and llmIrGenerator set, use LLM; else fall back to buildIRFromDiscovery
const ir =
  report.rawDocs?.length && this.deps.llmIrGenerator
    ? await this.deps.llmIrGenerator.generate(report.rawDocs.join('\n\n'))
    : buildIRFromDiscovery(report);
```

**Step 5: Run tests**

```bash
cd packages/cli && npx jest architect --no-coverage
```

Expected: all PASS

**Step 6: Commit**

```bash
git add packages/cli/src/agents/architect/
git commit -m "feat(architect): LLM-based semantic IR extraction from raw docs"
```

---

## Phase D — Better Builder Output (fastmcp Python)

### Task 8: Add fastmcp Python output format to prompt-builder

**Files:**

- Modify: `packages/core/src/codegen/prompt-builder.js` (or `.ts` if source available)
- Modify: `packages/cli/src/agents/builder/core-codegen.adapter.ts`

**Context:**
The current prompt-builder generates TypeScript using `===FILE===` format. We need to add a Python/fastmcp output option. The IR is already structured correctly — we just need a different prompt.

Check if TypeScript source for prompt-builder is in `packages/core/src/codegen/`:

```bash
ls packages/core/src/codegen/
```

**Step 1: Write failing test**

```typescript
// packages/core/src/codegen/prompt-builder.spec.ts (or add to existing)
import { buildFastmcpPrompt } from './prompt-builder';

it('generates fastmcp python prompt', () => {
  const prompt = buildFastmcpPrompt({
    system: { code: 'test', baseUrl: 'https://api.test.com', authType: 'none' },
    tools: [
      {
        name: 'list_users',
        description: 'list users',
        method: 'GET',
        path: '/users',
        params: [],
        needsConfirmation: false,
        isAsync: false
      }
    ]
  });
  expect(prompt).toContain('fastmcp');
  expect(prompt).toContain('list_users');
  expect(prompt).toContain('https://api.test.com');
});
```

**Step 2: Run to verify fail**

```bash
cd packages/core && npx jest prompt-builder --no-coverage
```

**Step 3: Add buildFastmcpPrompt**

Add to `prompt-builder.ts` (or `.js`):

```typescript
export function buildFastmcpPrompt(ir: IR): string {
  const toolDefs = ir.tools
    .map((tool) => {
      const paramLines =
        tool.params
          .map(
            (p) =>
              `    ${p.name}: Annotated[${p.type === 'string' ? 'str' : 'Any'}, "${p.description ?? p.name}"]`
          )
          .join(',\n') || '    # no params';

      return `
@mcp.tool()
async def ${tool.name}(${tool.params.length ? '\n' + paramLines + '\n' : ''}) -> str:
    """${tool.description}"""
    response = await client.request("${tool.method}", "${tool.path}"${tool.params.length ? ', params=locals()' : ''})
    return str(response.json())`;
    })
    .join('\n');

  return `You are an expert Python developer.
Generate a complete fastmcp MCP server based on the API spec below.
Output ONLY files in ===FILE=== format (path on next line, then content).

API Spec:
- base_url: ${ir.system.baseUrl}
- auth: ${ir.system.authType}
- tools: ${ir.tools.length}

Required files:
1. server.py — main fastmcp server
2. requirements.txt — dependencies (fastmcp, httpx)
3. README.md — usage instructions

The server.py must:
- import fastmcp
- use @mcp.tool() decorator for each tool
- use httpx.AsyncClient for HTTP calls
- handle errors gracefully

Tools to implement:
${toolDefs}

Now output the files in ===FILE=== format.`;
}
```

**Step 4: Run tests**

```bash
cd packages/core && npx jest prompt-builder --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add buildFastmcpPrompt for Python/fastmcp output format"
```

---

## Phase E — Config System

### Task 9: Add `~/.sga/config.yaml` support

**Files:**

- Create: `packages/cli/src/config/sga-config.ts`
- Create: `packages/cli/src/config/sga-config.spec.ts`
- Modify: `packages/cli/src/commands/config.command.ts`

**Context:**
Currently config lives in `.env` file. We want to add a global `~/.sga/config.yaml` that is the primary config source. The `.env` file remains as a project-level override.

Install: `pnpm add js-yaml --filter @sga/cli && pnpm add -D @types/js-yaml --filter @sga/cli`

**Step 1: Write failing tests**

```typescript
// packages/cli/src/config/sga-config.spec.ts
import { SgaConfig } from './sga-config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

it('loads config from yaml file', () => {
  const dir = join(tmpdir(), 'sga-test-' + Date.now());
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'config.yaml'),
    `
model:
  parser: anthropic/claude-sonnet-4.5
  coder: anthropic/claude-opus-4.6
market:
  url: https://market.sga.dev
  token: test-token
auto-publish: false
`
  );
  const cfg = new SgaConfig(join(dir, 'config.yaml'));
  expect(cfg.get('model.coder')).toBe('anthropic/claude-opus-4.6');
  expect(cfg.get('market.url')).toBe('https://market.sga.dev');
});

it('set() updates yaml file', () => {
  const dir = join(tmpdir(), 'sga-test-' + Date.now());
  mkdirSync(dir);
  const cfg = new SgaConfig(join(dir, 'config.yaml'));
  cfg.set('model.coder', 'anthropic/claude-opus-4.6');
  const cfg2 = new SgaConfig(join(dir, 'config.yaml'));
  expect(cfg2.get('model.coder')).toBe('anthropic/claude-opus-4.6');
});
```

**Step 2: Run to verify fail**

```bash
cd packages/cli && npx jest sga-config.spec --no-coverage
```

**Step 3: Implement sga-config.ts**

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import yaml from 'js-yaml';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.sga', 'config.yaml');

type ConfigValue = string | number | boolean;
type ConfigObj = Record<string, unknown>;

export class SgaConfig {
  private data: ConfigObj;

  public constructor(private readonly path: string = DEFAULT_CONFIG_PATH) {
    this.data = this.load();
  }

  private load(): ConfigObj {
    if (!existsSync(this.path)) return {};
    try {
      return (yaml.load(readFileSync(this.path, 'utf8')) as ConfigObj) ?? {};
    } catch {
      return {};
    }
  }

  private save(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, yaml.dump(this.data), 'utf8');
  }

  // dot-notation getter: cfg.get('model.coder')
  public get(key: string): ConfigValue | undefined {
    const parts = key.split('.');
    let cur: unknown = this.data;
    for (const part of parts) {
      if (typeof cur !== 'object' || cur === null) return undefined;
      cur = (cur as ConfigObj)[part];
    }
    return cur as ConfigValue;
  }

  // dot-notation setter: cfg.set('model.coder', 'claude-opus')
  public set(key: string, value: ConfigValue): void {
    const parts = key.split('.');
    let cur: ConfigObj = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof cur[part] !== 'object') cur[part] = {};
      cur = cur[part] as ConfigObj;
    }
    cur[parts[parts.length - 1]] = value;
    this.save();
  }

  public getAll(): ConfigObj {
    return { ...this.data };
  }
}
```

**Step 4: Update config.command.ts**

Add `config set <key> <value>` subcommand that calls `SgaConfig.set()`:

```typescript
config
  .command('set <key> <value>')
  .description('Set a config value (e.g. sga config set model.coder claude-opus-4.6)')
  .action((key: string, value: string) => {
    const cfg = new SgaConfig();
    cfg.set(key, value);
    console.log(chalk.green(`Set ${key} = ${value} in ${DEFAULT_CONFIG_PATH}`));
  });

config.command('show').action(() => {
  const cfg = new SgaConfig();
  console.log(yaml.dump(cfg.getAll()));
});
```

**Step 5: Run tests**

```bash
cd packages/cli && npx jest sga-config --no-coverage
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/cli/src/config/
git commit -m "feat(cli): add ~/.sga/config.yaml config system with dot-notation get/set"
```

---

## Phase F — Progress Display

### Task 10: Add ora spinner progress to generate command

**Files:**

- Modify: `packages/cli/src/commands/generate.command.ts`
- Modify: `packages/cli/src/commands/run.command.ts`

Install: `pnpm add ora --filter @sga/cli`

**Context:**
Currently output is just `console.log`. We want a pipeline progress display:

```
✔ Explorer  — found 12 files, 0 containers
✔ Architect — designed 8 MCP tools
⠸ Builder   — generating code...
  Tester    — waiting
```

**Step 1: Create progress helper**

```typescript
// packages/cli/src/utils/pipeline-progress.ts
import ora, { type Ora } from 'ora';
import chalk from 'chalk';

const STAGES = ['Explorer', 'Architect', 'Builder', 'Tester', 'Publisher'] as const;
type Stage = (typeof STAGES)[number];

export class PipelineProgress {
  private spinner: Ora | null = null;
  private completed: Stage[] = [];

  public start(stage: Stage, message: string): void {
    this.spinner?.stop();
    this.printCompleted();
    this.spinner = ora(`${chalk.cyan(stage.padEnd(10))} — ${message}`).start();
  }

  public done(stage: Stage, message: string): void {
    this.spinner?.stop();
    this.spinner = null;
    this.completed.push(stage);
    console.log(`${chalk.green('✔')} ${chalk.cyan(stage.padEnd(10))} — ${message}`);
  }

  public fail(stage: Stage, message: string): void {
    this.spinner?.fail(`${chalk.red('✘')} ${chalk.cyan(stage.padEnd(10))} — ${message}`);
    this.spinner = null;
  }

  private printCompleted(): void {
    // already printed above
  }
}
```

**Step 2: Wire into run.command.ts**

Replace `input.logger.log('Explorer...')` calls with `progress.start()` and `progress.done()`.

**Step 3: Verify visually**

```bash
cd packages/cli && pnpm build && node dist/index.js generate ./packages/cli/src/fixtures/sample-api
```

Expected: Animated spinner shows each stage

**Step 4: Commit**

```bash
git add packages/cli/src/utils/ packages/cli/src/commands/
git commit -m "feat(cli): add pipeline progress display with ora spinners"
```

---

## Phase G — Integration & End-to-End Test

### Task 11: End-to-end integration test

**Files:**

- Create: `packages/cli/src/e2e/generate-from-folder.spec.ts`

**Step 1: Write E2E test**

```typescript
// packages/cli/src/e2e/generate-from-folder.spec.ts
import { generateCommand } from '../commands/generate.command';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('E2E: generate from folder', () => {
  it('generates MCP server files from sample API fixture', async () => {
    const output = join(tmpdir(), 'sga-e2e-' + Date.now());
    const logs: string[] = [];

    await generateCommand({
      source: join(__dirname, '../fixtures/sample-api'),
      output,
      logger: { log: (m: string) => logs.push(m) },
      dryRun: true // skip actual LLM calls
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.toLowerCase().includes('explorer'))).toBe(true);
  }, 30_000);
});
```

**Step 2: Run**

```bash
cd packages/cli && npx jest e2e --no-coverage --testTimeout=30000
```

**Step 3: Run all CLI tests**

```bash
cd packages/cli && pnpm test
```

Expected: All pass

**Step 4: Final commit**

```bash
git add packages/cli/src/e2e/
git commit -m "test(cli): add E2E integration test for generate-from-folder"
```

---

## Summary: Task Order for Codex

| Phase | Tasks   | Dependency                 |
| ----- | ------- | -------------------------- |
| A     | 1, 2, 3 | None — start here          |
| B     | 4, 5    | None — can parallel with A |
| B     | 6       | After 4+5                  |
| C     | 7       | After 1+6                  |
| D     | 8       | After 7 (needs IR working) |
| E     | 9       | None — independent         |
| F     | 10      | After 1+2                  |
| G     | 11      | After all above            |

**Parallel execution:** Tasks A(1-3) and B(4-5) and E(9) can run in parallel.

## Verification Checklist (Claude's job)

After Codex completes:

- [ ] `pnpm -r test` passes with no failures
- [ ] `sga generate ./packages/cli/src/fixtures/sample-api` runs without crashing
- [ ] `sga config set model.coder anthropic/claude-opus-4.6` updates `~/.sga/config.yaml`
- [ ] `sga --help` shows correct binary name `sga`
- [ ] Generated server.py uses fastmcp format
- [ ] URL input (`sga generate https://...`) triggers BrowserTool
