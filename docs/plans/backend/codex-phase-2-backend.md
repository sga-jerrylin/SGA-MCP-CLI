# Phase 2 (Backend, Codex) - `@mcp-claw/core` Shared Engine Detailed Plan

Goal: move generator logic from `packages/backend/src/generator/*` into a reusable `@mcp-claw/core` package so both MCP Hub backend and CLI Agent can call the same engine.

Architecture Adjustment (v1.3 + 2026-02-17 memo):
1. Old Phase 2 target: Hub backend internal AI module.
2. New Phase 2 target: shared engine in `E:\mcp\packages\core\src\*`.
3. Hub backend becomes a thin orchestration layer that delegates generation/testing/packaging to core.

Conventions:
1. Every task is intentionally small (2-5 minutes).
2. TDD loop per task: write test -> run (fail) -> implement -> run (pass) -> commit.
3. Use absolute file paths in every task.
4. Commit messages follow Conventional Commits.

Path Migration Rules:
- `E:\mcp\packages\backend\src\generator\ir\*` -> `E:\mcp\packages\core\src\ir\*`
- `E:\mcp\packages\backend\src\generator\parsers\*` -> `E:\mcp\packages\core\src\parsers\*`
- `E:\mcp\packages\backend\src\generator\codegen\*` -> `E:\mcp\packages\core\src\codegen\*`
- `E:\mcp\packages\backend\src\generator\autofix\*` -> `E:\mcp\packages\core\src\autofix\*`
- `E:\mcp\packages\backend\src\generator\adapters\*` -> `E:\mcp\packages\core\src\adapters\*`

---

## Task 2.1: Create `@mcp-claw/core` package manifest

Files:
- Create: `E:\mcp\packages\core\package.json`
- Create: `E:\mcp\packages\core\package.spec.ts`
- Modify: `E:\mcp\package.json`

TDD:
1. Write `package.spec.ts` to assert package name/version/main/types/exports.
2. Run: `pnpm -C E:\mcp\packages\core test -- package.spec.ts` (expect FAIL).
3. Implement `package.json` with `name: "@mcp-claw/core"` and workspace-friendly scripts.
4. Re-run test (expect PASS).
5. Commit: `feat(core): bootstrap @mcp-claw/core package manifest`

Key code:
```json
{
  "name": "@mcp-claw/core",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- package.spec.ts
```
Expected: `PASS`.

---

## Task 2.2: Add core TypeScript build config

Files:
- Create: `E:\mcp\packages\core\tsconfig.json`
- Create: `E:\mcp\packages\core\tsconfig.build.json`
- Create: `E:\mcp\packages\core\tsconfig.spec.ts`

TDD:
1. Write spec verifying strict mode + declaration emit + outDir.
2. Run tests (expect FAIL).
3. Implement TS configs.
4. Re-run tests (expect PASS).
5. Commit: `build(core): add tsconfig and build config`

Key code:
```json
{
  "compilerOptions": {
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "moduleResolution": "node"
  },
  "include": ["src/**/*.ts"]
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- tsconfig.spec.ts
```
Expected: `PASS`.

---

## Task 2.3: Add `core` public entrypoint exports

Files:
- Create: `E:\mcp\packages\core\src\index.ts`
- Create: `E:\mcp\packages\core\src\index.spec.ts`

TDD:
1. Write spec asserting exported symbols (`McpClawCore`, `IR`, parser adapters).
2. Run tests (expect FAIL).
3. Implement export barrel.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add root exports for shared engine`

Key code:
```ts
export * from './ir/ir';
export * from './parsers/markdown/markdown-parser';
export * from './adapters/openapi/openapi-adapter';
export * from './core/mcp-claw-core';
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- index.spec.ts
```
Expected: `PASS`.

---

## Task 2.4: Define IR interfaces under core

Files:
- Create: `E:\mcp\packages\core\src\ir\ir.ts`
- Create: `E:\mcp\packages\core\src\ir\ir.spec.ts`

TDD:
1. Write spec validating minimal `IR` object shape.
2. Run tests (expect FAIL).
3. Implement interface/type definitions.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): define canonical IR model`

Key code:
```ts
export interface IR {
  system: { code: string; baseUrl: string; authType: 'none' | 'bearer' | 'api-key' | 'oauth2' | 'hmac' };
  tools: Array<{ name: string; method: string; path: string; needsConfirmation: boolean; isAsync: boolean }>;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- ir.spec.ts
```
Expected: `PASS`.

---

## Task 2.5: Add IR zod validation

Files:
- Create: `E:\mcp\packages\core\src\ir\ir.zod.ts`
- Create: `E:\mcp\packages\core\src\ir\ir.zod.spec.ts`

TDD:
1. Write tests for valid IR and invalid auth type.
2. Run tests (expect FAIL).
3. Implement Zod schema.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): validate IR with zod`

Key code:
```ts
import { z } from 'zod';

export const AuthTypeZ = z.enum(['none', 'bearer', 'api-key', 'oauth2', 'hmac']);
export const IrSchema = z.object({
  system: z.object({ code: z.string().min(1), baseUrl: z.string().url(), authType: AuthTypeZ }),
  tools: z.array(z.object({ name: z.string().min(1), method: z.string(), path: z.string() })),
});
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- ir.zod.spec.ts
```
Expected: `PASS`.

---

## Task 2.6: Add diagnostic error model for parsers

Files:
- Create: `E:\mcp\packages\core\src\errors\diagnostic-error.ts`
- Create: `E:\mcp\packages\core\src\errors\diagnostic-error.spec.ts`

TDD:
1. Write spec expecting error contains code/section/hint.
2. Run tests (expect FAIL).
3. Implement `DiagnosticError`.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add parser diagnostic error type`

Key code:
```ts
export class DiagnosticError extends Error {
  constructor(public readonly meta: { code: string; section: string; hint?: string }) {
    super(meta.code);
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- diagnostic-error.spec.ts
```
Expected: `PASS`.

---

## Task 2.7: Implement markdown system info parser

Files:
- Create: `E:\mcp\packages\core\src\parsers\markdown\markdown-parser.ts`
- Create: `E:\mcp\packages\core\src\parsers\markdown\markdown-parser.system.spec.ts`
- Create: `E:\mcp\packages\core\src\parsers\markdown\fixtures\system-info.md`

TDD:
1. Write test parsing `system code / base URL / auth type` from fixture.
2. Run tests (expect FAIL).
3. Implement `parseSystemInfo`.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): parse markdown system info`

Key code:
```ts
function field(md: string, key: string): string {
  const m = md.match(new RegExp(`-\\s*${key}:\\s*(.+)$`, 'm'));
  return (m?.[1] ?? '').trim();
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- markdown-parser.system.spec.ts
```
Expected: `PASS`.

---

## Task 2.8: Implement markdown tool section parser

Files:
- Create: `E:\mcp\packages\core\src\parsers\markdown\markdown-parser.tool.spec.ts`
- Create: `E:\mcp\packages\core\src\parsers\markdown\fixtures\tool-section.md`
- Modify: `E:\mcp\packages\core\src\parsers\markdown\markdown-parser.ts`

TDD:
1. Write spec for method/path/tool name/confirmation/async flags.
2. Run tests (expect FAIL).
3. Implement `parseToolHeader`.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): parse markdown tool sections`

Key code:
```ts
const needsConfirmation = /needs confirmation:\s*yes/i.test(section);
const isAsync = /async:\s*yes/i.test(section);
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- markdown-parser.tool.spec.ts
```
Expected: `PASS`.

---

## Task 2.9: Add OpenAPI adapter interface in core

Files:
- Create: `E:\mcp\packages\core\src\adapters\openapi\openapi-adapter.ts`
- Create: `E:\mcp\packages\core\src\adapters\openapi\openapi-adapter.spec.ts`

TDD:
1. Write spec: adapter rejects documents without `paths`.
2. Run tests (expect FAIL).
3. Implement interface + guard.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add openapi adapter contract`

Key code:
```ts
import type { IR } from '../../ir/ir';

export interface OpenApiAdapter {
  toIR(doc: unknown): Promise<IR>;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- openapi-adapter.spec.ts
```
Expected: `PASS`.

---

## Task 2.10: Implement adapter wrapper for `openapi-mcp-generator`

Files:
- Modify: `E:\mcp\packages\core\package.json`
- Create: `E:\mcp\packages\core\src\adapters\openapi\openapi-mcp-generator.adapter.ts`
- Create: `E:\mcp\packages\core\src\adapters\openapi\openapi-mcp-generator.adapter.spec.ts`

TDD:
1. Write spec: tiny OpenAPI document maps to IR tool entries.
2. Run tests (expect FAIL).
3. Add dependency and implement adapter mapping layer.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add openapi-mcp-generator adapter`

Key code:
```ts
export class OpenApiMcpGeneratorAdapter {
  async toIR(doc: unknown): Promise<IR> {
    // Keep upstream isolated behind one adapter file.
    const parsed = await this.upstream.generate(doc as any);
    return mapUpstreamToIr(parsed);
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- openapi-mcp-generator.adapter.spec.ts
```
Expected: `PASS`.

---

## Task 2.11: Add JSON schema generator from IR params

Files:
- Create: `E:\mcp\packages\core\src\schema\json-schema-generator.ts`
- Create: `E:\mcp\packages\core\src\schema\json-schema-generator.spec.ts`

TDD:
1. Write spec for required and optional properties.
2. Run tests (expect FAIL).
3. Implement generator.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): generate json schema from IR`

Key code:
```ts
export function buildObjectSchema(params: Array<{ name: string; type: string; required: boolean }>) {
  return {
    type: 'object',
    properties: Object.fromEntries(params.map((p) => [p.name, { type: mapType(p.type) }])),
    required: params.filter((p) => p.required).map((p) => p.name),
    additionalProperties: false,
  };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- json-schema-generator.spec.ts
```
Expected: `PASS`.

---

## Task 2.12: Add codegen prompt builder module

Files:
- Create: `E:\mcp\packages\core\src\codegen\prompt-builder.ts`
- Create: `E:\mcp\packages\core\src\codegen\prompt-builder.spec.ts`

TDD:
1. Write spec asserting deterministic prompt sections from IR.
2. Run tests (expect FAIL).
3. Implement prompt builder.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add deterministic prompt builder`

Key code:
```ts
export function buildCodegenPrompt(ir: IR): string {
  return [
    `System: ${ir.system.code}`,
    `BaseURL: ${ir.system.baseUrl}`,
    `Tools: ${ir.tools.map((t) => t.name).join(', ')}`,
  ].join('\n');
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- prompt-builder.spec.ts
```
Expected: `PASS`.

---

## Task 2.13: Implement code generation service

Files:
- Create: `E:\mcp\packages\core\src\codegen\codegen.service.ts`
- Create: `E:\mcp\packages\core\src\codegen\codegen.service.spec.ts`

TDD:
1. Write spec: service calls LLM client and returns file set (`auth.ts`, `client.ts`, `tools/*`).
2. Run tests (expect FAIL).
3. Implement service with mockable LLM client.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): implement codegen service contract`

Key code:
```ts
export interface GeneratedFile { path: string; content: string }

export class CodegenService {
  constructor(private readonly llm: { complete(prompt: string): Promise<string> }) {}
  async generate(ir: IR): Promise<GeneratedFile[]> {
    const prompt = buildCodegenPrompt(ir);
    const raw = await this.llm.complete(prompt);
    return parseGeneratedFiles(raw);
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- codegen.service.spec.ts
```
Expected: `PASS`.

---

## Task 2.14: Add sandbox execution contract

Files:
- Create: `E:\mcp\packages\core\src\sandbox\sandbox-port.ts`
- Create: `E:\mcp\packages\core\src\sandbox\sandbox-port.spec.ts`

TDD:
1. Write spec for request/response DTOs and timeout handling.
2. Run tests (expect FAIL).
3. Implement interfaces and timeout helper.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): define sandbox execution port`

Key code:
```ts
export interface SandboxRunRequest { files: Array<{ path: string; content: string }>; timeoutMs: number }
export interface SandboxRunResult { passed: boolean; logs: string[]; failedTests: string[] }
export interface SandboxPort { runTests(req: SandboxRunRequest): Promise<SandboxRunResult> }
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- sandbox-port.spec.ts
```
Expected: `PASS`.

---

## Task 2.15: Implement sandbox HTTP adapter

Files:
- Create: `E:\mcp\packages\core\src\sandbox\sandbox-http.adapter.ts`
- Create: `E:\mcp\packages\core\src\sandbox\sandbox-http.adapter.spec.ts`

TDD:
1. Write spec for success and timeout failures.
2. Run tests (expect FAIL).
3. Implement adapter calling worker endpoint.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add sandbox http adapter`

Key code:
```ts
export class SandboxHttpAdapter implements SandboxPort {
  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch) {}
  async runTests(req: SandboxRunRequest): Promise<SandboxRunResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/run-tests`, { method: 'POST', body: JSON.stringify(req) });
    return (await res.json()) as SandboxRunResult;
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- sandbox-http.adapter.spec.ts
```
Expected: `PASS`.

---

## Task 2.16: Add autofix patch planner

Files:
- Create: `E:\mcp\packages\core\src\autofix\patch-planner.ts`
- Create: `E:\mcp\packages\core\src\autofix\patch-planner.spec.ts`

TDD:
1. Write spec: failed test logs produce bounded patch request.
2. Run tests (expect FAIL).
3. Implement planner with max changed files guard.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add autofix patch planner`

Key code:
```ts
export function createPatchRequest(logs: string[], maxFiles = 5) {
  return { reason: logs.slice(-20).join('\n'), maxFiles };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- patch-planner.spec.ts
```
Expected: `PASS`.

---

## Task 2.17: Implement repair loop orchestrator

Files:
- Create: `E:\mcp\packages\core\src\autofix\repair-loop.ts`
- Create: `E:\mcp\packages\core\src\autofix\repair-loop.spec.ts`

TDD:
1. Write spec: max 3 rounds then `needsHuman=true`.
2. Run tests (expect FAIL).
3. Implement retry loop over codegen + sandbox + autofix.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): implement bounded repair loop`

Key code:
```ts
for (let round = 1; round <= 3; round += 1) {
  const result = await sandbox.runTests(request);
  if (result.passed) return { passed: true, round };
  await fixer.apply(result.failedTests);
}
return { passed: false, needsHuman: true };
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- repair-loop.spec.ts
```
Expected: `PASS`.

---

## Task 2.18: Implement token budget analyzer in core

Files:
- Create: `E:\mcp\packages\core\src\budget\token-budget.ts`
- Create: `E:\mcp\packages\core\src\budget\token-budget.spec.ts`

TDD:
1. Write spec: serialized tools payload over 8000 raises warning.
2. Run tests (expect FAIL).
3. Implement estimator + threshold policy.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add tools list token budget checker`

Key code:
```ts
export function checkTokenBudget(serializedTools: string, threshold = 8000) {
  const estimated = Math.ceil(serializedTools.length / 4);
  return { estimated, overBudget: estimated > threshold };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- token-budget.spec.ts
```
Expected: `PASS`.

---

## Task 2.19: Add packager facade contract in core

Files:
- Create: `E:\mcp\packages\core\src\packager\packager.ts`
- Create: `E:\mcp\packages\core\src\packager\packager.spec.ts`

TDD:
1. Write spec for manifest + sbom + signature metadata structure.
2. Run tests (expect FAIL).
3. Implement contract and simple in-memory implementation.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): define package assembly contract`

Key code:
```ts
export interface PackageArtifact {
  archivePath: string;
  manifestPath: string;
  sbomPath: string;
  signaturePath: string;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- packager.spec.ts
```
Expected: `PASS`.

---

## Task 2.20: Implement `McpClawCore` facade for one-call orchestration

Files:
- Create: `E:\mcp\packages\core\src\core\mcp-claw-core.ts`
- Create: `E:\mcp\packages\core\src\core\mcp-claw-core.spec.ts`
- Modify: `E:\mcp\packages\core\src\index.ts`

TDD:
1. Write spec: `generate()` executes parse -> codegen -> sandbox -> package pipeline.
2. Run tests (expect FAIL).
3. Implement orchestrator with dependency injection.
4. Re-run tests (expect PASS).
5. Commit: `feat(core): add McpClawCore facade`

Key code:
```ts
export class McpClawCore {
  constructor(private readonly deps: CoreDeps) {}
  async generate(input: { kind: 'markdown' | 'openapi'; content: string }) {
    const ir = await this.deps.parse(input);
    const files = await this.deps.codegen(ir);
    const test = await this.deps.sandbox.runTests({ files, timeoutMs: 30 * 60 * 1000 });
    return this.deps.packager.build({ ir, files, test });
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\core test -- mcp-claw-core.spec.ts
```
Expected: `PASS`.

---

## Task 2.21: Convert Hub backend generator service to thin core wrapper

Files:
- Modify: `E:\mcp\packages\backend\package.json`
- Modify: `E:\mcp\packages\backend\src\generator\generator.service.ts`
- Create: `E:\mcp\packages\backend\src\generator\generator.service.spec.ts`

TDD:
1. Write spec: backend service delegates to `McpClawCore.generate` exactly once.
2. Run tests (expect FAIL).
3. Add `@mcp-claw/core` dependency and implement delegation logic.
4. Re-run tests (expect PASS).
5. Commit: `refactor(backend): delegate generator service to @mcp-claw/core`

Key code:
```ts
import { Injectable } from '@nestjs/common';
import { McpClawCore } from '@mcp-claw/core';

@Injectable()
export class GeneratorService {
  constructor(private readonly core: McpClawCore) {}
  generateFromDoc(content: string) {
    return this.core.generate({ kind: 'markdown', content });
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- generator.service.spec.ts
```
Expected: `PASS`.

---

## Task 2.22: Add backend-to-core integration test and migration note

Files:
- Create: `E:\mcp\packages\backend\test\integration\core-delegation.spec.ts`
- Create: `E:\mcp\docs\guides\phase-2-core-migration.md`

TDD:
1. Write integration test: upload path triggers backend service and receives core artifact metadata.
2. Run tests (expect FAIL).
3. Implement glue wiring (provider registration/module import).
4. Re-run tests (expect PASS).
5. Commit: `test(backend): add integration coverage for core delegation`

Key code:
```ts
it('delegates generation pipeline to shared core', async () => {
  const res = await service.generateFromDoc('# API Doc');
  expect(res).toHaveProperty('manifestPath');
});
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- core-delegation.spec.ts
```
Expected: `PASS`.

---

## Phase 2 Exit Checklist

1. `@mcp-claw/core` compiles and its tests pass.
2. Hub backend generation service is a thin API wrapper over core.
3. All migrated modules live in `E:\mcp\packages\core\src\*`.
4. No new business logic added under `E:\mcp\packages\backend\src\generator` except orchestration/adapters.
5. Core exports are stable for Phase 2.5 CLI Agent and Phase 4 runtime integration.
