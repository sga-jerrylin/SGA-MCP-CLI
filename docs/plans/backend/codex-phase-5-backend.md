# Phase 5 (Backend, Codex) — Hub Infrastructure (Queue, Storage, Audit, Metrics) Detailed Plan

Goal: add governance/operability: async task queue patterns, file storage with tenant isolation, audit logging with redaction, and Prometheus/OpenTelemetry hooks.

---

## Task 5.1: Async Task Entities + Status Model

Files:
- Create: `E:\mcp\packages\backend\src\tasks\db\task.entity.ts`
- Create: `E:\mcp\packages\backend\src\tasks\db\task.entity.spec.ts`

TDD:
1. Spec: task has status enum (`queued|running|succeeded|failed|canceled`) and tenantId.
2. Run tests (fail).
3. Implement entity.
4. Re-run (pass).
5. Commit: `feat(tasks): add task entity`

Key code:
```ts
export type TaskStatus = 'queued'|'running'|'succeeded'|'failed'|'canceled';
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- task.entity.spec.ts
```
Expected: `PASS`.

---

## Task 5.2: Task Queue Producer (BullMQ) + Worker Stub

Files:
- Create: `E:\mcp\packages\backend\src\tasks\queue\tasks.queue.ts`
- Create: `E:\mcp\packages\backend\src\tasks\queue\tasks.queue.spec.ts`
- Create: `E:\mcp\packages\backend\src\tasks\worker\tasks.worker.ts`

TDD:
1. Spec: `enqueue()` calls `queue.add()` with deterministic job name and opts.
2. Run tests (fail).
3. Implement producer and a minimal worker skeleton.
4. Re-run (pass).
5. Commit: `feat(tasks): add bullmq task queue producer`

Key code:
```ts
await this.queue.add('task.execute', payload, { attempts: 3, backoff: { type: 'exponential', delay: 500 } });
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- tasks.queue.spec.ts
```
Expected: `PASS`.

---

## Task 5.3: File Storage Service (MinIO) — Presigned URLs

Files:
- Create: `E:\mcp\packages\backend\src\storage\presign\presign.service.ts`
- Create: `E:\mcp\packages\backend\src\storage\presign\presign.service.spec.ts`

TDD:
1. Spec: returns presigned PUT/GET URLs; enforces bucket/key tenant prefix or tenant bucket.
2. Run tests (fail).
3. Implement wrapper around MinIO SDK.
4. Re-run (pass).
5. Commit: `feat(storage): add presigned url service`

Key code:
```ts
return this.client.presignedPutObject(bucket, key, 60);
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- presign.service.spec.ts
```
Expected: `PASS`.

---

## Task 5.4: Audit Log Entity + Redaction Enforcement

Files:
- Create: `E:\mcp\packages\backend\src\audit\db\audit-log.entity.ts`
- Create: `E:\mcp\packages\backend\src\audit\db\audit-log.entity.spec.ts`
- Create: `E:\mcp\packages\backend\src\audit\audit.service.ts`
- Create: `E:\mcp\packages\backend\src\audit\audit.service.spec.ts`

TDD:
1. Spec: `record()` stores redacted request/response excerpts.
2. Run tests (fail).
3. Implement service using `redactSecrets()` from Phase 1.
4. Re-run (pass).
5. Commit: `feat(audit): add audit log with secret redaction`

Key code:
```ts
const safe = redactSecrets(JSON.stringify(payload));
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- audit.service.spec.ts
```
Expected: `PASS`.

---

## Task 5.5: Audit Query API (pagination + filters)

Files:
- Create: `E:\mcp\packages\backend\src\audit\api\audit.controller.ts`
- Create: `E:\mcp\packages\backend\src\audit\api\audit.controller.spec.ts`

TDD:
1. Spec: `GET /api/audit` paginates and filters by `tenantId`, `action`, `from/to`.
2. Run tests (fail).
3. Implement controller + query service.
4. Re-run (pass).
5. Commit: `feat(audit): add audit query endpoint`

Verify:
```powershell
curl "http://localhost:3000/api/audit?page=1&pageSize=20"
```
Expected: `{ "items":[...], "total": ... }`.

---

## Task 5.6: Prometheus Metrics Endpoint

Files:
- Create: `E:\mcp\packages\backend\src\metrics\metrics.module.ts`
- Create: `E:\mcp\packages\backend\src\metrics\metrics.controller.ts`
- Create: `E:\mcp\packages\backend\src\metrics\metrics.controller.spec.ts`

TDD:
1. Spec: `GET /metrics` returns `text/plain` and includes a counter line.
2. Run tests (fail).
3. Implement using `prom-client`.
4. Re-run (pass).
5. Commit: `feat(metrics): expose prometheus metrics endpoint`

Key code:
```ts
@Get('metrics')
@Header('Content-Type', register.contentType)
metrics() { return register.metrics(); }
```

Verify:
```powershell
curl http://localhost:3000/metrics
```
Expected: includes `process_cpu_user_seconds_total` (or custom metric).

---

## Task 5.7: OpenTelemetry Tracing Bootstrap (HTTP + DB)

Files:
- Create: `E:\mcp\packages\backend\src\observability\otel.ts`
- Create: `E:\mcp\packages\backend\src\observability\otel.spec.ts`
- Modify: `E:\mcp\packages\backend\src\main.ts`

TDD:
1. Spec: initializing OTEL registers a tracer provider (unit test with mocks).
2. Run tests (fail).
3. Implement minimal `NodeSDK` bootstrap with env toggles.
4. Re-run (pass).
5. Commit: `feat(obs): add opentelemetry bootstrap`

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- otel.spec.ts
```
Expected: `PASS`.

