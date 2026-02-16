# Phase 2.5 (Backend, Codex) - CLI Agent Engine Detailed Plan

Goal: implement backend logic for `@mcp-claw/cli` so the CLI can run a deterministic Agent Loop (`Plan -> Act -> Observe`) and orchestrate the five core roles (Explorer, Architect, Builder, Tester, Deployer) using `@mcp-claw/core`.

Scope boundaries:
1. This phase is backend logic only (agent logic, tooling, orchestration, state, model routing, memory).
2. Terminal UX/polish is tracked separately by frontend/interaction planning.
3. All tasks are micro-scoped for 2-5 minute execution.

Conventions:
1. Paths are absolute Windows paths.
2. TDD for each task: write test -> run fail -> implement -> run pass -> commit.
3. Each task includes one concrete TypeScript example and one verification command.
4. Commit messages use Conventional Commits.

Primary package roots:
- `E:\mcp\packages\cli\src\agents\*`
- `E:\mcp\packages\cli\src\loop\*`
- `E:\mcp\packages\cli\src\tools\*`
- `E:\mcp\packages\cli\src\config\*`
- `E:\mcp\packages\cli\src\memory\*`

---

## Task 2.5.1: Define CLI runtime package contract

Files:
- Modify: `E:\mcp\packages\cli\package.json`
- Create: `E:\mcp\packages\cli\package.spec.ts`
- Modify: `E:\mcp\package.json`

TDD:
1. Write `package.spec.ts` to assert deps include `@mcp-claw/core`, `zod`, `execa`, and test scripts.
2. Run: `pnpm -C E:\mcp\packages\cli test -- package.spec.ts` (expect FAIL).
3. Implement package metadata and scripts.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli): define runtime package contract`

Key code:
```json
{
  "name": "@mcp-claw/cli",
  "version": "0.1.0",
  "dependencies": {
    "@mcp-claw/core": "workspace:*",
    "zod": "^3.23.8",
    "execa": "^9.5.2"
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- package.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.2: Add core loop domain types (`Plan`, `Action`, `Observation`)

Files:
- Create: `E:\mcp\packages\cli\src\loop\loop.types.ts`
- Create: `E:\mcp\packages\cli\src\loop\loop.types.spec.ts`

TDD:
1. Write spec that validates required fields for `PlanStep`, `ActionCall`, and `Observation`.
2. Run tests (expect FAIL).
3. Implement interfaces and helper constructors.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-loop): add loop domain types`

Key code:
```ts
export interface PlanStep { id: string; role: 'explorer' | 'architect' | 'builder' | 'tester' | 'deployer'; goal: string }
export interface ActionCall { stepId: string; tool: string; input: Record<string, unknown> }
export interface Observation { stepId: string; ok: boolean; summary: string; artifacts?: string[] }
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- loop.types.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.3: Implement loop state machine (`Plan -> Act -> Observe`)

Files:
- Create: `E:\mcp\packages\cli\src\loop\agent-loop.state-machine.ts`
- Create: `E:\mcp\packages\cli\src\loop\agent-loop.state-machine.spec.ts`

TDD:
1. Write spec for legal transitions and invalid transition rejection.
2. Run tests (expect FAIL).
3. Implement state machine with explicit enum transitions.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-loop): add plan-act-observe state machine`

Key code:
```ts
export type LoopState = 'planning' | 'acting' | 'observing' | 'finished' | 'failed';

export function nextState(current: LoopState, event: 'plan_done' | 'act_done' | 'observe_done' | 'error'): LoopState {
  if (current === 'planning' && event === 'plan_done') return 'acting';
  if (current === 'acting' && event === 'act_done') return 'observing';
  if (current === 'observing' && event === 'observe_done') return 'finished';
  if (event === 'error') return 'failed';
  throw new Error(`Invalid transition: ${current} -> ${event}`);
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- agent-loop.state-machine.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.4: Add role agent interface and registry

Files:
- Create: `E:\mcp\packages\cli\src\agents\agent.interface.ts`
- Create: `E:\mcp\packages\cli\src\agents\agent-registry.ts`
- Create: `E:\mcp\packages\cli\src\agents\agent-registry.spec.ts`

TDD:
1. Write spec verifying registry can register/get agents and rejects duplicates.
2. Run tests (expect FAIL).
3. Implement interface + map-based registry.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-agents): add role registry`

Key code:
```ts
export interface AgentRole {
  role: 'explorer' | 'architect' | 'builder' | 'tester' | 'deployer';
  run(input: unknown): Promise<unknown>;
}

export class AgentRegistry {
  private roles = new Map<string, AgentRole>();
  register(agent: AgentRole) { if (this.roles.has(agent.role)) throw new Error('duplicate role'); this.roles.set(agent.role, agent); }
  get(role: AgentRole['role']) { return this.roles.get(role); }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- agent-registry.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.5: Explorer role - filesystem scanner tool

Files:
- Create: `E:\mcp\packages\cli\src\tools\fs-tool.ts`
- Create: `E:\mcp\packages\cli\src\tools\fs-tool.spec.ts`
- Create: `E:\mcp\packages\cli\src\agents\explorer\fs-scanner.ts`

TDD:
1. Write spec to scan project tree and return API-related files (`*.md`, `openapi*.json`, `docker-compose*.yml`).
2. Run tests (expect FAIL).
3. Implement tool + explorer wrapper.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-explorer): add filesystem scanner`

Key code:
```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function scanWorkspace(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await fs.readdir(root)) {
    const p = path.join(root, name);
    if (/openapi|docker-compose|\.md$/i.test(name)) out.push(p);
  }
  return out;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- fs-tool.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.6: Explorer role - Docker container inspector

Files:
- Create: `E:\mcp\packages\cli\src\tools\docker-tool.ts`
- Create: `E:\mcp\packages\cli\src\tools\docker-tool.spec.ts`
- Create: `E:\mcp\packages\cli\src\agents\explorer\docker-inspector.ts`

TDD:
1. Write spec mocking `docker ps --format json` output and parse container metadata.
2. Run tests (expect FAIL).
3. Implement command wrapper with timeout and parser.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-explorer): add docker inspector`

Key code:
```ts
import { execa } from 'execa';

export async function listContainers(): Promise<Array<{ id: string; image: string; status: string }>> {
  const { stdout } = await execa('docker', ['ps', '--format', '{{json .}}']);
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const row = JSON.parse(line);
    return { id: row.ID, image: row.Image, status: row.Status };
  });
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- docker-tool.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.7: Explorer role - HTTP endpoint prober

Files:
- Create: `E:\mcp\packages\cli\src\tools\http-tool.ts`
- Create: `E:\mcp\packages\cli\src\tools\http-tool.spec.ts`
- Create: `E:\mcp\packages\cli\src\agents\explorer\http-prober.ts`

TDD:
1. Write spec probing target URLs and returning status code + latency.
2. Run tests (expect FAIL).
3. Implement fetch-based probe with abort timeout.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-explorer): add endpoint probe tool`

Key code:
```ts
export async function probe(url: string, timeoutMs = 3000) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    return { url, status: res.status, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- http-tool.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.8: Explorer role - web fetch + structured parser

Files:
- Create: `E:\mcp\packages\cli\src\tools\web-tool.ts`
- Create: `E:\mcp\packages\cli\src\tools\web-tool.spec.ts`
- Create: `E:\mcp\packages\cli\src\agents\explorer\web-parser.ts`

TDD:
1. Write spec extracting title/headings/links from HTML.
2. Run tests (expect FAIL).
3. Implement lightweight parser (regex + guardrails; no heavy DOM needed for v1).
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-explorer): add web scrape parser`

Key code:
```ts
export function parseHtmlSummary(html: string) {
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
  const h1 = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)].map((m) => m[1]);
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
  return { title, h1, links: links.slice(0, 50) };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- web-tool.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.9: Explorer orchestrator combines 4 probes into one report

Files:
- Create: `E:\mcp\packages\cli\src\agents\explorer\explorer.agent.ts`
- Create: `E:\mcp\packages\cli\src\agents\explorer\explorer.agent.spec.ts`

TDD:
1. Write spec ensuring explorer merges fs/docker/http/web observations.
2. Run tests (expect FAIL).
3. Implement aggregator + deterministic output ordering.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-explorer): orchestrate multi-source discovery`

Key code:
```ts
export class ExplorerAgent {
  async run(input: { root: string; urls: string[] }) {
    const files = await scanWorkspace(input.root);
    const containers = await listContainers();
    const endpoints = await Promise.all(input.urls.map((u) => probe(u)));
    return { files, containers, endpoints };
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- explorer.agent.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.10: Architect role - API knowledge graph entities

Files:
- Create: `E:\mcp\packages\cli\src\agents\architect\knowledge-graph.types.ts`
- Create: `E:\mcp\packages\cli\src\agents\architect\knowledge-graph.types.spec.ts`

TDD:
1. Write spec asserting `ApiNode`, `EndpointNode`, and `Relation` invariants.
2. Run tests (expect FAIL).
3. Implement graph node/edge interfaces and builders.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-architect): add knowledge graph domain types`

Key code:
```ts
export interface ApiNode { id: string; kind: 'api'; name: string }
export interface EndpointNode { id: string; kind: 'endpoint'; method: string; path: string }
export interface Relation { from: string; to: string; type: 'owns_endpoint' | 'depends_on' }
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- knowledge-graph.types.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.11: Architect role - build knowledge graph from explorer report

Files:
- Create: `E:\mcp\packages\cli\src\agents\architect\knowledge-graph.builder.ts`
- Create: `E:\mcp\packages\cli\src\agents\architect\knowledge-graph.builder.spec.ts`

TDD:
1. Write spec converting discovered endpoints/files into graph nodes/edges.
2. Run tests (expect FAIL).
3. Implement graph builder.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-architect): build graph from explorer output`

Key code:
```ts
export function buildGraph(input: { endpoints: Array<{ url: string; status: number }> }) {
  const api: ApiNode = { id: 'api:target', kind: 'api', name: 'target-system' };
  const endpointNodes = input.endpoints.map((e, i) => ({ id: `ep:${i}`, kind: 'endpoint', method: 'GET', path: e.url }));
  const edges = endpointNodes.map((ep) => ({ from: api.id, to: ep.id, type: 'owns_endpoint' as const }));
  return { nodes: [api, ...endpointNodes], edges };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- knowledge-graph.builder.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.12: Architect role - token budget analysis via `@mcp-claw/core`

Files:
- Create: `E:\mcp\packages\cli\src\agents\architect\token-budget-analyzer.ts`
- Create: `E:\mcp\packages\cli\src\agents\architect\token-budget-analyzer.spec.ts`

TDD:
1. Write spec that marks warnings when estimated `tools/list` tokens exceed 8000.
2. Run tests (expect FAIL).
3. Implement analyzer by calling core budget util.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-architect): integrate core token budget analysis`

Key code:
```ts
import { checkTokenBudget } from '@mcp-claw/core';

export function analyzeToolBudget(serialized: string) {
  const result = checkTokenBudget(serialized, 8000);
  return { ...result, severity: result.overBudget ? 'warning' : 'ok' };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- token-budget-analyzer.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.13: Architect role - shard decision engine

Files:
- Create: `E:\mcp\packages\cli\src\agents\architect\shard-decision.ts`
- Create: `E:\mcp\packages\cli\src\agents\architect\shard-decision.spec.ts`

TDD:
1. Write spec for assigning tools into shard groups based on domain + token budget.
2. Run tests (expect FAIL).
3. Implement greedy sharding strategy with hard caps.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-architect): add shard decision engine`

Key code:
```ts
export function shardTools(tools: Array<{ name: string; domain: string; tokenCost: number }>, maxTokens = 8000) {
  const shards: Array<{ id: string; tokenCost: number; tools: string[] }> = [];
  for (const tool of tools) {
    let shard = shards.find((s) => s.tokenCost + tool.tokenCost <= maxTokens);
    if (!shard) {
      shard = { id: `shard-${shards.length + 1}`, tokenCost: 0, tools: [] };
      shards.push(shard);
    }
    shard.tools.push(tool.name);
    shard.tokenCost += tool.tokenCost;
  }
  return shards;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- shard-decision.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.14: Builder role - core codegen adapter

Files:
- Create: `E:\mcp\packages\cli\src\agents\builder\core-codegen.adapter.ts`
- Create: `E:\mcp\packages\cli\src\agents\builder\core-codegen.adapter.spec.ts`

TDD:
1. Write spec for mapping architect plan to `McpClawCore.generate` input.
2. Run tests (expect FAIL).
3. Implement adapter.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-builder): add adapter to core codegen`

Key code:
```ts
import { McpClawCore } from '@mcp-claw/core';

export class CoreCodegenAdapter {
  constructor(private readonly core: McpClawCore) {}
  run(planDoc: string) {
    return this.core.generate({ kind: 'markdown', content: planDoc });
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- core-codegen.adapter.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.15: Builder role - generation task assembler

Files:
- Create: `E:\mcp\packages\cli\src\agents\builder\generation-task.assembler.ts`
- Create: `E:\mcp\packages\cli\src\agents\builder\generation-task.assembler.spec.ts`

TDD:
1. Write spec for assembling generation tasks with deterministic ids and input hashes.
2. Run tests (expect FAIL).
3. Implement assembler.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-builder): assemble deterministic generation tasks`

Key code:
```ts
import { createHash } from 'node:crypto';

export function createGenerationTask(input: { projectId: string; irJson: string }) {
  const hash = createHash('sha256').update(input.irJson).digest('hex');
  return { id: `${input.projectId}:${hash.slice(0, 12)}`, hash, createdAt: new Date().toISOString() };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- generation-task.assembler.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.16: Tester role - sandbox adapter (core sandbox port)

Files:
- Create: `E:\mcp\packages\cli\src\agents\tester\sandbox.adapter.ts`
- Create: `E:\mcp\packages\cli\src\agents\tester\sandbox.adapter.spec.ts`

TDD:
1. Write spec for submitting generated files to sandbox and receiving result DTO.
2. Run tests (expect FAIL).
3. Implement adapter wrapper around core sandbox API.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-tester): add sandbox execution adapter`

Key code:
```ts
import type { SandboxPort, SandboxRunResult } from '@mcp-claw/core';

export class TesterSandboxAdapter {
  constructor(private readonly sandbox: SandboxPort) {}
  execute(files: Array<{ path: string; content: string }>): Promise<SandboxRunResult> {
    return this.sandbox.runTests({ files, timeoutMs: 30 * 60 * 1000 });
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- sandbox.adapter.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.17: Tester role - test cycle manager

Files:
- Create: `E:\mcp\packages\cli\src\agents\tester\test-cycle.manager.ts`
- Create: `E:\mcp\packages\cli\src\agents\tester\test-cycle.manager.spec.ts`

TDD:
1. Write spec for cycle outcomes (`passed`, `failed`, `timeout`) and event emission.
2. Run tests (expect FAIL).
3. Implement manager.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-tester): manage sandbox test cycle`

Key code:
```ts
export class TestCycleManager {
  async run(files: Array<{ path: string; content: string }>, adapter: TesterSandboxAdapter) {
    const result = await adapter.execute(files);
    return result.passed ? { status: 'passed', result } : { status: 'failed', result };
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- test-cycle.manager.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.18: Tester role - auto-fix retry controller (max 3 rounds)

Files:
- Create: `E:\mcp\packages\cli\src\agents\tester\autofix.controller.ts`
- Create: `E:\mcp\packages\cli\src\agents\tester\autofix.controller.spec.ts`

TDD:
1. Write spec enforcing maximum 3 rounds and explicit `needsHuman` final state.
2. Run tests (expect FAIL).
3. Implement retry controller.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-tester): add bounded autofix controller`

Key code:
```ts
export async function runAutofixLoop(runOnce: () => Promise<boolean>, maxRounds = 3) {
  for (let i = 1; i <= maxRounds; i += 1) {
    if (await runOnce()) return { passed: true, round: i };
  }
  return { passed: false, needsHuman: true, round: maxRounds };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- autofix.controller.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.19: Deployer role - compose file renderer

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\compose.renderer.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\compose.renderer.spec.ts`

TDD:
1. Write spec that renders deterministic `docker-compose.yml` for selected shards.
2. Run tests (expect FAIL).
3. Implement YAML renderer.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): render docker compose from deployment plan`

Key code:
```ts
export function renderCompose(services: Array<{ name: string; image: string; port: number }>) {
  const lines = ['version: "3.9"', 'services:'];
  for (const svc of services) {
    lines.push(`  ${svc.name}:`);
    lines.push(`    image: ${svc.image}`);
    lines.push(`    ports: ["${svc.port}:${svc.port}"]`);
  }
  return `${lines.join('\n')}\n`;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- compose.renderer.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.20: Deployer role - docker lifecycle runner

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\docker.runner.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\docker.runner.spec.ts`

TDD:
1. Write spec for `compose up`, `compose down`, and controlled timeout behavior.
2. Run tests (expect FAIL).
3. Implement execa wrapper with explicit command allowlist.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): add docker lifecycle runner`

Key code:
```ts
import { execa } from 'execa';

export async function composeUp(file: string) {
  return execa('docker', ['compose', '-f', file, 'up', '-d'], { timeout: 120_000 });
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- docker.runner.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.21: Deployer role - post-start health checker

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\health-checker.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\health-checker.spec.ts`

TDD:
1. Write spec for retrying `/health` endpoints and reporting unhealthy services.
2. Run tests (expect FAIL).
3. Implement checker with capped retries and jitter.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): add deployment health checker`

Key code:
```ts
export async function waitHealthy(urls: string[], retries = 10) {
  const failed: string[] = [];
  for (const url of urls) {
    let ok = false;
    for (let i = 0; i < retries; i += 1) {
      const res = await fetch(`${url}/health`).catch(() => null);
      if (res?.ok) { ok = true; break; }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ok) failed.push(url);
  }
  return { ok: failed.length === 0, failed };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- health-checker.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.22: Model config management - provider schema + secure loader

Files:
- Create: `E:\mcp\packages\cli\src\config\models.schema.ts`
- Create: `E:\mcp\packages\cli\src\config\models.loader.ts`
- Create: `E:\mcp\packages\cli\src\config\models.loader.spec.ts`

TDD:
1. Write spec for validating Claude/Gemini/DeepSeek provider config shape.
2. Run tests (expect FAIL).
3. Implement zod schema + `.env` backed loader.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-config): add multi-model config schema`

Key code:
```ts
import { z } from 'zod';

export const ProviderSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'deepseek', 'openai']),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  baseUrl: z.string().url().optional(),
});
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- models.loader.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.23: Model config management - task-aware model router

Files:
- Create: `E:\mcp\packages\cli\src\config\model-router.ts`
- Create: `E:\mcp\packages\cli\src\config\model-router.spec.ts`

TDD:
1. Write spec mapping task types (`analyze`, `codegen`, `autofix`) to preferred models with fallback.
2. Run tests (expect FAIL).
3. Implement weighted/fallback selection.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-config): add model routing policy`

Key code:
```ts
export function pickModel(task: 'analyze' | 'codegen' | 'autofix', pool: Record<string, string>) {
  if (task === 'codegen' && pool.claude) return pool.claude;
  if (task === 'analyze' && pool.gemini) return pool.gemini;
  if (task === 'autofix' && pool.deepseek) return pool.deepseek;
  return Object.values(pool)[0];
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- model-router.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.24: Memory module - session store and retrieval API

Files:
- Create: `E:\mcp\packages\cli\src\memory\session-store.ts`
- Create: `E:\mcp\packages\cli\src\memory\session-store.spec.ts`

TDD:
1. Write spec for appending/retrieving events by session id.
2. Run tests (expect FAIL).
3. Implement file-backed session store.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-memory): add session store`

Key code:
```ts
export class SessionStore {
  private readonly db = new Map<string, Array<{ role: string; text: string }>>();
  append(sessionId: string, event: { role: string; text: string }) {
    const arr = this.db.get(sessionId) ?? [];
    arr.push(event);
    this.db.set(sessionId, arr);
  }
  read(sessionId: string) { return this.db.get(sessionId) ?? []; }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- session-store.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.25: Memory module - context summarizer and pruning policy

Files:
- Create: `E:\mcp\packages\cli\src\memory\context-pruner.ts`
- Create: `E:\mcp\packages\cli\src\memory\context-pruner.spec.ts`

TDD:
1. Write spec for keeping most recent events plus summary when token budget is exceeded.
2. Run tests (expect FAIL).
3. Implement pruning utility.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-memory): add context pruning`

Key code:
```ts
export function pruneContext(events: string[], maxTokens = 6000) {
  const kept: string[] = [];
  let tokens = 0;
  for (const e of [...events].reverse()) {
    const cost = Math.ceil(e.length / 4);
    if (tokens + cost > maxTokens) break;
    kept.unshift(e);
    tokens += cost;
  }
  return { events: kept, estimatedTokens: tokens };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- context-pruner.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.26: Wire full CLI agent loop orchestrator and integration test

Files:
- Create: `E:\mcp\packages\cli\src\loop\agent-loop.ts`
- Create: `E:\mcp\packages\cli\src\commands\run.command.ts`
- Create: `E:\mcp\packages\cli\src\loop\agent-loop.integration.spec.ts`

TDD:
1. Write integration spec: Explorer -> Architect -> Builder -> Tester -> Deployer path with mocks.
2. Run tests (expect FAIL).
3. Implement loop orchestration and command entrypoint.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-loop): orchestrate all five agents end-to-end`

Key code:
```ts
export async function runLoop(input: { root: string; urls: string[] }, deps: any) {
  const discovery = await deps.explorer.run(input);
  const plan = await deps.architect.run(discovery);
  const build = await deps.builder.run(plan);
  const test = await deps.tester.run(build);
  if (!test.passed) return { status: 'needs-human', test };
  const deploy = await deps.deployer.run(build);
  return { status: 'done', deploy };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- agent-loop.integration.spec.ts
```
Expected: `PASS`.

---

## Phase 2.5 Exit Checklist

1. Plan -> Act -> Observe loop is implemented and covered by integration tests.
2. All five roles are implemented as independent backend modules:
   - Explorer: filesystem scanner, Docker inspector, HTTP prober, web parser.
   - Architect: knowledge graph, token budget analyzer, shard decision engine.
   - Builder: core codegen adapter and generation task assembler.
   - Tester: sandbox adapter, test manager, bounded autofix loop.
   - Deployer: compose renderer, container runner, health checker.
3. Multi-model config supports Claude/Gemini/DeepSeek and fallback routing.
4. Memory module supports session history plus context pruning.
5. CLI orchestrator command can run full chain in tests.
6. Task-level commits follow Conventional Commits.

---

## Task 2.5.27: Deployer Agent - contract-typed compose generation

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\compose-from-contract.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\compose-from-contract.spec.ts`

TDD:
1. Write test that converts `DeployPreviewRequest.serverIds` into deterministic compose services.
2. Run tests (expect FAIL).
3. Implement generator using shared contract types.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): add contract-typed compose generation`

Key code:
```ts
import type { DeployPreviewRequest, McpServer } from '@mcp-claw/shared';

export function buildComposeFromRequest(req: DeployPreviewRequest, servers: McpServer[]): string {
  const selected = servers.filter((s) => req.serverIds.includes(s.id));
  const lines = ['version: "3.9"', 'services:'];
  for (const s of selected) {
    lines.push(`  ${s.id}:`);
    lines.push(`    image: mcp-claw/mcp-server:latest`);
    lines.push(`    ports: ["${s.port}:${s.port}"]`);
  }
  return `${lines.join('\n')}\n`;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- compose-from-contract.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.28: Deployer Agent - container start workflow with typed task state

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\deploy-task.runner.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\deploy-task.runner.spec.ts`

TDD:
1. Write test for lifecycle transitions `pending -> pulling -> starting -> verifying -> done`.
2. Run tests (expect FAIL).
3. Implement runner using shared `DeployTask` and `DeployStatus` semantics.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): add typed deploy task runner`

Key code:
```ts
import type { DeployTask, DeployStatus } from '@mcp-claw/shared';

export function nextDeployStatus(current: DeployStatus, ok: boolean): DeployStatus {
  if (!ok) return 'failed';
  if (current === 'pending') return 'pulling';
  if (current === 'pulling') return 'starting';
  if (current === 'starting') return 'verifying';
  if (current === 'verifying') return 'done';
  return current;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- deploy-task.runner.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.29: Deployer Agent - health verification against runtime contract

Files:
- Create: `E:\mcp\packages\cli\src\agents\deployer\runtime-health.verify.ts`
- Create: `E:\mcp\packages\cli\src\agents\deployer\runtime-health.verify.spec.ts`

TDD:
1. Write test validating health report typed as `McpServerDetail[]` and failure list.
2. Run tests (expect FAIL).
3. Implement verifier with retries and typed mapping.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-deployer): add runtime health verification`

Key code:
```ts
import type { McpServerDetail } from '@mcp-claw/shared';

export async function verifyServers(servers: McpServerDetail[]) {
  const failed = servers.filter((s) => s.status !== 'healthy').map((s) => s.id);
  return { ok: failed.length === 0, failed };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- runtime-health.verify.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.30: Memory module - persistent session repository (disk-backed)

Files:
- Create: `E:\mcp\packages\cli\src\memory\session-repository.ts`
- Create: `E:\mcp\packages\cli\src\memory\session-repository.spec.ts`

TDD:
1. Write test for save/load/delete session transcripts on disk.
2. Run tests (expect FAIL).
3. Implement JSON-file repository with atomic write.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-memory): add persistent session repository`

Key code:
```ts
import { promises as fs } from 'node:fs';

export async function saveSession(filePath: string, data: unknown) {
  const temp = `${filePath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, filePath);
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- session-repository.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.31: Memory module - context memory service with retrieval API

Files:
- Create: `E:\mcp\packages\cli\src\memory\context-memory.service.ts`
- Create: `E:\mcp\packages\cli\src\memory\context-memory.service.spec.ts`

TDD:
1. Write test for append/query/summarize by `sessionId` and role.
2. Run tests (expect FAIL).
3. Implement context memory service.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-memory): add context memory retrieval service`

Key code:
```ts
export interface MemoryEvent { sessionId: string; role: string; content: string; ts: string }

export class ContextMemoryService {
  private items: MemoryEvent[] = [];
  append(e: MemoryEvent) { this.items.push(e); }
  query(sessionId: string) { return this.items.filter((x) => x.sessionId === sessionId); }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- context-memory.service.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.32: CLI -> Hub Sync module - typed API client foundation

Files:
- Create: `E:\mcp\packages\cli\src\sync\hub-api.client.ts`
- Create: `E:\mcp\packages\cli\src\sync\hub-api.client.spec.ts`

TDD:
1. Write test for typed wrappers returning `ApiResponse<T>` from shared definitions.
2. Run tests (expect FAIL).
3. Implement authenticated client with Bearer token injection.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-sync): add typed hub api client`

Key code:
```ts
import type { ApiResponse, SyncPushResponse } from '@mcp-claw/shared';

export class HubApiClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}
  async pushPackage(form: FormData): Promise<ApiResponse<SyncPushResponse>> {
    const res = await fetch(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    return (await res.json()) as ApiResponse<SyncPushResponse>;
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- hub-api.client.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.33: CLI -> Hub Sync `push` command

Files:
- Create: `E:\mcp\packages\cli\src\commands\sync-push.command.ts`
- Create: `E:\mcp\packages\cli\src\commands\sync-push.command.spec.ts`

TDD:
1. Write test for uploading `package`, `manifest`, `signature` and optional `autoDeploy`.
2. Run tests (expect FAIL).
3. Implement command using `/sync/push` contract.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-sync): add push command`

Key code:
```ts
import type { ApiResponse, SyncPushResponse } from '@mcp-claw/shared';

export async function runSyncPush(client: HubApiClient, input: {
  packagePath: string;
  manifestPath: string;
  signature: string;
  autoDeploy?: boolean;
}): Promise<ApiResponse<SyncPushResponse>> {
  const form = new FormData();
  form.set('signature', input.signature);
  form.set('autoDeploy', String(Boolean(input.autoDeploy)));
  return client.pushPackage(form);
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- sync-push.command.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.34: CLI -> Hub Sync `pull` command

Files:
- Create: `E:\mcp\packages\cli\src\commands\sync-pull.command.ts`
- Create: `E:\mcp\packages\cli\src\commands\sync-pull.command.spec.ts`

TDD:
1. Write test for downloading binary from `/sync/pull/{packageId}` and storing as tar.gz.
2. Run tests (expect FAIL).
3. Implement pull command with filesystem write.
4. Re-run tests (expect PASS).
5. Commit: `feat(cli-sync): add pull command`

Key code:
```ts
export async function runSyncPull(baseUrl: string, token: string, packageId: string, outPath: string) {
  const res = await fetch(`${baseUrl}/sync/pull/${packageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await import('node:fs/promises').then((fs) => fs.writeFile(outPath, buf));
  return outPath;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- sync-pull.command.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.35: Add Sync integration test (`push -> optional deploy -> pull`)

Files:
- Create: `E:\mcp\packages\cli\test\integration\sync-flow.integration.spec.ts`

TDD:
1. Write integration test chaining push response (`packageId`) into pull command.
2. Run tests (expect FAIL).
3. Implement command orchestration glue.
4. Re-run tests (expect PASS).
5. Commit: `test(cli-sync): add push-pull integration flow`

Key code:
```ts
it('supports push then pull by packageId', async () => {
  const pushed = await runSyncPush(client, input);
  const out = await runSyncPull(baseUrl, token, pushed.data.packageId, 'tmp/out.tar.gz');
  expect(out.endsWith('.tar.gz')).toBe(true);
});
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- sync-flow.integration.spec.ts
```
Expected: `PASS`.

---

## Task 2.5.36: Enforce shared-type-only rule in CLI package

Files:
- Create: `E:\mcp\packages\cli\eslint-rules\no-local-api-types.js`
- Modify: `E:\mcp\packages\cli\.eslintrc.cjs`
- Create: `E:\mcp\packages\cli\test\lint\shared-types-only.spec.ts`

TDD:
1. Write lint test that fails if `src/**` defines duplicate API DTOs that exist in `@mcp-claw/shared`.
2. Run tests (expect FAIL with fixture).
3. Implement custom lint rule and config.
4. Re-run tests (expect PASS).
5. Commit: `chore(cli): enforce api types from @mcp-claw/shared`

Key code:
```js
// no-local-api-types.js
module.exports = {
  meta: { type: 'problem' },
  create(context) {
    return {
      TSInterfaceDeclaration(node) {
        const banned = new Set(['ApiResponse', 'Project', 'McpServer', 'SyncPushResponse']);
        if (banned.has(node.id.name)) {
          context.report({ node, message: `Use @mcp-claw/shared type ${node.id.name} instead of local redefinition.` });
        }
      },
    };
  },
};
```

Verify:
```powershell
pnpm -C E:\mcp\packages\cli test -- test/lint/shared-types-only.spec.ts
```
Expected: `PASS`.
