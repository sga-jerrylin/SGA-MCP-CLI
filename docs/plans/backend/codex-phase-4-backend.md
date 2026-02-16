# Phase 4 (Backend, Codex) — MCP Runtime (13 Servers) + Directory + Deploy Detailed Plan

Goal: ship the MCP Runtime architecture: 13 independent MCP Servers, directory service (Server Registry), token budget enforcement, TLS + tenant API key auth, and deploy orchestrator that generates docker-compose + nginx config.

---

## Task 4.1: MCP Protocol Types + Minimal Handler Interface

Files:
- Create: `E:\mcp\packages\mcp-server\src\mcp\mcp.types.ts`
- Create: `E:\mcp\packages\mcp-server\src\mcp\mcp.types.spec.ts`

TDD:
1. Spec: type guards validate `tools/list` and `tools/call` shapes.
2. Run tests (fail).
3. Implement minimal types + guards.
4. Re-run (pass).
5. Commit: `feat(mcp-server): add mcp protocol types`

Key code:
```ts
export type McpTool = { name: string; description?: string; inputSchema?: unknown };
export type ToolsListResponse = { tools: McpTool[] };
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- mcp.types.spec.ts
```
Expected: `PASS`.

---

## Task 4.2: MCP Server NestJS App Bootstrap

Files:
- Create: `E:\mcp\packages\mcp-server\src\main.ts`
- Create: `E:\mcp\packages\mcp-server\src\app.module.ts`
- Create: `E:\mcp\packages\mcp-server\src\health\health.controller.ts`
- Create: `E:\mcp\packages\mcp-server\src\health\health.controller.spec.ts`

TDD:
1. Spec: `GET /health` returns ok.
2. Run tests (fail).
3. Implement controller + module.
4. Re-run (pass).
5. Commit: `feat(mcp-server): bootstrap nest app with health endpoint`

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server dev
curl http://localhost:3000/health
```
Expected: `{"status":"ok",...}`.

---

## Task 4.3: Connector Loader (dynamic import from mounted connectors dir)

Files:
- Create: `E:\mcp\packages\mcp-server\src\loader\connector-loader.ts`
- Create: `E:\mcp\packages\mcp-server\src\loader\connector-loader.spec.ts`

TDD:
1. Spec: loads a fixture connector module and returns exported tools map.
2. Run tests (fail).
3. Implement loader using `import()` with file URL and a strict allowlist of paths.
4. Re-run (pass).
5. Commit: `feat(mcp-server): add connector dynamic loader`

Key code:
```ts
// Never import from untrusted paths; connectors directory is mounted read-only.
const mod = await import(pathToFileURL(fullPath).toString());
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- connector-loader.spec.ts
```
Expected: `PASS`.

---

## Task 4.4: Implement `tools/list` Endpoint (server-local tools only)

Files:
- Create: `E:\mcp\packages\mcp-server\src\mcp\tools.controller.ts`
- Create: `E:\mcp\packages\mcp-server\src\mcp\tools.controller.spec.ts`

TDD:
1. Spec: returns tools loaded by loader; never returns tools from other servers.
2. Run tests (fail).
3. Implement controller.
4. Re-run (pass).
5. Commit: `feat(mcp-server): implement tools/list`

Key code:
```ts
@Post('mcp/tools/list')
listTools() { return { tools: this.registry.list() }; }
```

Verify:
```powershell
curl -X POST http://localhost:3000/mcp/tools/list
```
Expected: `{ "tools": [ ... ] }`.

---

## Task 4.5: Implement `tools/call` Endpoint (dispatch + validation)

Files:
- Create: `E:\mcp\packages\mcp-server\src\mcp\call.controller.ts`
- Create: `E:\mcp\packages\mcp-server\src\mcp\call.controller.spec.ts`

TDD:
1. Spec: unknown tool returns 404; known tool invoked with params.
2. Run tests (fail).
3. Implement controller + registry dispatch.
4. Re-run (pass).
5. Commit: `feat(mcp-server): implement tools/call dispatch`

Key code:
```ts
@Post('mcp/tools/call')
async call(@Body() body: { name: string; arguments?: any }) { return this.runner.run(body.name, body.arguments); }
```

Verify:
```powershell
curl -X POST http://localhost:3000/mcp/tools/call -H "Content-Type: application/json" -d "{\"name\":\"wecom.send_text\",\"arguments\":{}}"
```
Expected: `200` or validation error.

---

## Task 4.6: HTTP Connection Pool (keep-alive agent) + Unit Test

Files:
- Create: `E:\mcp\packages\mcp-server\src\net\http-agent.factory.ts`
- Create: `E:\mcp\packages\mcp-server\src\net\http-agent.factory.spec.ts`

TDD:
1. Spec: factory returns an Agent with `keepAlive=true` and configured `maxSockets`.
2. Run tests (fail).
3. Implement.
4. Re-run (pass).
5. Commit: `feat(mcp-server): add keep-alive agent factory`

Key code:
```ts
return new Agent({ keepAlive: true, maxSockets: cfg.maxSocketsPerHost });
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- http-agent.factory.spec.ts
```
Expected: `PASS`.

---

## Task 4.7: Rate Limiter (token bucket) Middleware

Files:
- Create: `E:\mcp\packages\mcp-server\src\middleware\rate-limiter.ts`
- Create: `E:\mcp\packages\mcp-server\src\middleware\rate-limiter.spec.ts`

TDD:
1. Spec: allows N requests per second; rejects beyond burst.
2. Run tests (fail).
3. Implement in-memory token bucket (Phase 5 adds Redis distributed option).
4. Re-run (pass).
5. Commit: `feat(mcp-server): add per-tool token bucket limiter`

Key code:
```ts
if (bucket.tokens < 1) throw new TooManyRequestsException();
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- rate-limiter.spec.ts
```
Expected: `PASS`.

---

## Task 4.8: Circuit Breaker Middleware (rolling window)

Files:
- Create: `E:\mcp\packages\mcp-server\src\middleware\circuit-breaker.ts`
- Create: `E:\mcp\packages\mcp-server\src\middleware\circuit-breaker.spec.ts`

TDD:
1. Spec: 5 consecutive failures opens breaker for 30s; success closes.
2. Run tests (fail).
3. Implement.
4. Re-run (pass).
5. Commit: `feat(mcp-server): add circuit breaker middleware`

Key code:
```ts
if (state.openUntil && Date.now() < state.openUntil) throw new ServiceUnavailableException('Circuit open');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- circuit-breaker.spec.ts
```
Expected: `PASS`.

---

## Task 4.9: Tenant API Key Guard (Bearer token) for MCP Server

Files:
- Create: `E:\mcp\packages\mcp-server\src\auth\tenant-api-key.guard.ts`
- Create: `E:\mcp\packages\mcp-server\src\auth\tenant-api-key.guard.spec.ts`

TDD:
1. Spec: missing/invalid key rejects; valid key attaches `tenant` context.
2. Run tests (fail).
3. Implement guard calling Hub Vault/Key service (mock in tests).
4. Re-run (pass).
5. Commit: `feat(mcp-server): enforce tenant api key auth`

Key code:
```ts
const raw = authHeader?.replace(/^Bearer\\s+/i, '');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\mcp-server test -- tenant-api-key.guard.spec.ts
```
Expected: `PASS`.

---

## Task 4.10: Token Budget Service (serialize tools/list + estimate tokens)

Files:
- Create: `E:\mcp\packages\backend\src\servers\token-budget\token-budget.service.ts`
- Create: `E:\mcp\packages\backend\src\servers\token-budget\token-budget.service.spec.ts`

TDD:
1. Spec: given a tool list, estimator returns count; throws if > 8000.
2. Run tests (fail).
3. Implement using `tiktoken` (or pluggable estimator if offline).
4. Re-run (pass).
5. Commit: `feat(servers): add tools/list token budget enforcement`

Key code:
```ts
const tokenCount = estimateTokens(JSON.stringify(payload));
if (tokenCount > 8000) throw new Error('Auto-split required');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- token-budget.service.spec.ts
```
Expected: `PASS`.

---

## Task 4.11: Directory Service (Server Registry) — Entities + APIs

Files:
- Create: `E:\mcp\packages\backend\src\servers\registry\server.entity.ts`
- Create: `E:\mcp\packages\backend\src\servers\registry\servers.controller.ts`
- Create: `E:\mcp\packages\backend\src\servers\registry\servers.controller.spec.ts`
- Create: `E:\mcp\packages\backend\src\servers\registry\registry.module.ts`

TDD:
1. Spec: `GET /api/servers` returns servers; `GET /api/servers/:id` returns tools/health.
2. Run tests (fail).
3. Implement controller + service.
4. Re-run (pass).
5. Commit: `feat(directory): add server registry APIs`

Key code:
```ts
@Get('api/servers')
list() { return this.svc.list(); }
```

Verify:
```powershell
curl http://localhost:3000/api/servers
```
Expected: `{ "servers": [ ... ] }`.

---

## Task 4.12: Health Monitor Scheduler (poll MCP servers)

Files:
- Create: `E:\mcp\packages\backend\src\servers\health\health-monitor.service.ts`
- Create: `E:\mcp\packages\backend\src\servers\health\health-monitor.service.spec.ts`

TDD:
1. Spec: polls configured server endpoints; marks unhealthy on timeout.
2. Run tests (fail).
3. Implement with `undici` and timeouts.
4. Re-run (pass).
5. Commit: `feat(directory): add health monitor scheduler`

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- health-monitor.service.spec.ts
```
Expected: `PASS`.

---

## Task 4.13: Deploy Orchestrator — Generate docker-compose.yml

Files:
- Create: `E:\mcp\packages\backend\src\deploy\compose\compose-generator.ts`
- Create: `E:\mcp\packages\backend\src\deploy\compose\compose-generator.spec.ts`
- Create: `E:\mcp\packages\backend\src\deploy\deploy.controller.ts`
- Create: `E:\mcp\packages\backend\src\deploy\deploy.controller.spec.ts`

TDD:
1. Spec: enabling servers yields compose yaml with correct services/volumes and no exposed MCP ports.
2. Run tests (fail).
3. Implement generator using js-yaml.
4. Re-run (pass).
5. Commit: `feat(deploy): generate docker-compose for enabled servers`

Key code:
```ts
// Render YAML; keep secrets in Docker secrets, never inline.
```

Verify:
```powershell
curl -X POST http://localhost:3000/api/deploy -H "Content-Type: application/json" -d "{\"enabledServers\":[\"wecom-msg\"]}"
```
Expected: `{ "composeFile": "version: '3.8'\\nservices: ...", "status":"deploying" }`.

---

## Task 4.14: Nginx Config Generator (TLS + routing to 13 servers)

Files:
- Create: `E:\mcp\packages\backend\src\deploy\nginx\nginx-conf-generator.ts`
- Create: `E:\mcp\packages\backend\src\deploy\nginx\nginx-conf-generator.spec.ts`

TDD:
1. Spec: config contains `server { listen 443 ssl; }` and upstreams for enabled servers.
2. Run tests (fail).
3. Implement generator.
4. Re-run (pass).
5. Commit: `feat(deploy): generate nginx tls reverse proxy config`

Key code:
```nginx
location /mcp/wecom-msg/ { proxy_pass http://mcp-wecom-msg:3000/; }
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- nginx-conf-generator.spec.ts
```
Expected: `PASS`.

