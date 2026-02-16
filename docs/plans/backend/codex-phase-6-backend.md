# Phase 6 (Backend, Codex) — Integration, Hardening, Performance, Release Detailed Plan

Goal: prove the whole system works end-to-end, meets security/perf bars, and is deployable with clear runbooks.

---

## Task 6.1: E2E Smoke Script (API-driven)

Files:
- Create: `E:\mcp\packages\backend\test\e2e\smoke.e2e-spec.ts`
- Create: `E:\mcp\packages\backend\test\e2e\fixtures\sample-api.md`

TDD:
1. Write e2e test covering: create generator project → start generate job (mocked worker) → receive SSE events.
2. Run `pnpm -C E:\mcp\packages\backend test:e2e` (expect FAIL).
3. Implement missing endpoints/wiring (from earlier phases).
4. Re-run (expect PASS).
5. Commit: `test(e2e): add smoke e2e for generator workflow`

Key code:
```ts
// Use supertest for HTTP + EventSource polyfill for SSE.
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test:e2e
```
Expected: `PASS`.

---

## Task 6.2: Runtime Contract Tests (tools/list ≤ 8000 tokens)

Files:
- Create: `E:\mcp\packages\backend\test\contract\token-budget.contract.spec.ts`

TDD:
1. Spec: loads registry tool fixtures and asserts budget enforcement.
2. Run tests (fail).
3. Implement estimator integration / fixture generation.
4. Re-run (pass).
5. Commit: `test(contract): enforce tools/list token budget`

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- token-budget.contract.spec.ts
```
Expected: `PASS`.

---

## Task 6.3: Security Regression Tests (Vault AAD, API key hashing)

Files:
- Create: `E:\mcp\packages\backend\test\security\vault-aad.spec.ts`
- Create: `E:\mcp\packages\backend\test\security\tenant-api-key.spec.ts`

TDD:
1. Spec: decrypt with wrong AAD must fail; tenant API keys must never be stored raw.
2. Run tests (fail).
3. Fix any implementation gaps.
4. Re-run (pass).
5. Commit: `test(security): add vault aad and api key hashing regressions`

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- vault-aad.spec.ts
```
Expected: `PASS`.

---

## Task 6.4: Load Test Harness (k6) for MCP Server

Files:
- Create: `E:\mcp\scripts\loadtest\mcp-tools-call.js`
- Create: `E:\mcp\scripts\loadtest\README.md`

TDD:
1. Write script and validate it runs against localhost with a single tool.
2. Run: `k6 run ...` (expect FAIL if k6 missing).
3. Document install and expected metrics.
4. Commit: `perf: add k6 load test scripts for mcp server`

Key code:
```js
import http from 'k6/http';
export default function () { http.post(`${__ENV.BASE}/mcp/tools/call`, JSON.stringify({ name: 'x', arguments: {} })); }
```

Verify:
```powershell
k6 run E:\mcp\scripts\loadtest\mcp-tools-call.js
```
Expected: p95 latency line + 0% errors (in healthy env).

---

## Task 6.5: Database Migration for RLS + Policies (sql files)

Files:
- Create: `E:\mcp\packages\backend\src\migrations\0001_rls.sql`
- Create: `E:\mcp\packages\backend\src\migrations\0001_rls.spec.ts`

TDD:
1. Spec: migration file contains `ENABLE ROW LEVEL SECURITY` and policies for core tables.
2. Run tests (fail).
3. Implement migration and a sanity parser test (or run against ephemeral pg in CI later).
4. Re-run (pass).
5. Commit: `feat(db): add rls migrations and policies`

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- 0001_rls.spec.ts
```
Expected: `PASS`.

---

## Task 6.6: Ops Runbooks (TLS rotation, master key rotation, backup/restore)

Files:
- Create: `E:\mcp\docs\guides\ops-tls-rotation.md`
- Create: `E:\mcp\docs\guides\ops-master-key-rotation.md`
- Create: `E:\mcp\docs\guides\ops-backup-restore.md`

TDD (docs):
1. Add checklists and commands; peer review.
2. Commit: `docs(ops): add tls/master-key rotation and backup runbooks`

Verify:
```powershell
rg -n \"ROLLBACK\" E:\\mcp\\docs\\guides\\ops-*.md
```
Expected: each runbook includes rollback steps.

---

## Task 6.7: Release Checklist + Versioning

Files:
- Create: `E:\mcp\docs\plans\release-checklist.md`
- Modify: `E:\mcp\packages\backend\package.json`
- Modify: `E:\mcp\packages\mcp-server\package.json`
- Modify: `E:\mcp\packages\sandbox-worker\package.json`

TDD:
1. Ensure `pnpm test` and `pnpm lint` pass (once deps are available).
2. Tagging + changelog steps.
3. Commit: `chore(release): add release checklist and bump versions`

Verify:
```powershell
pnpm -C E:\mcp -r test
```
Expected: all workspace tests pass.

