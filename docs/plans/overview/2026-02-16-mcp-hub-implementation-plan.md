# MCP Claw Ecosystem Implementation Plan (CLI + Hub)

> Goal: deliver the MCP Claw ecosystem as two products on one shared engine:
> 1. `@mcp-claw/cli` (open-source AI Agent CLI)
> 2. MCP Hub (enterprise web control plane)
> 3. `@mcp-claw/core` (shared generation/runtime engine)

## 1. Program Scope

### Product positioning
- `@mcp-claw/core`: reusable engine for parsing, IR, codegen, sandbox test, autofix, token budgeting, packaging.
- `@mcp-claw/cli`: vertical AI agent workflow from discovery to deploy (`Plan -> Act -> Observe`).
- `MCP Hub`: enterprise governance, multi-tenant operations, vault, registry, deployment and monitoring.

### Architecture baseline
- Frontend: Vue 3 + TypeScript + Ant Design Vue.
- Backend: NestJS + TypeScript.
- Shared engine: TypeScript package consumed by CLI and backend.
- Runtime: 13 independent MCP Servers + server directory.
- Data: PostgreSQL + Redis + MinIO.
- Security: TLS + tenant API keys + Auth Vault (AES-256-GCM) + sandbox worker isolation.

---

## 2. Monorepo Structure (Updated)

```text
E:\mcp
├─ packages/
│  ├─ core/                # @mcp-claw/core shared engine
│  │  ├─ src/
│  │  │  ├─ ir/
│  │  │  ├─ parsers/
│  │  │  ├─ adapters/
│  │  │  ├─ codegen/
│  │  │  ├─ sandbox/
│  │  │  ├─ autofix/
│  │  │  ├─ budget/
│  │  │  └─ packager/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  ├─ cli/                 # @mcp-claw/cli agent runtime
│  │  ├─ src/
│  │  │  ├─ agents/
│  │  │  ├─ loop/
│  │  │  ├─ tools/
│  │  │  ├─ config/
│  │  │  ├─ memory/
│  │  │  └─ commands/
│  │  ├─ bin/
│  │  └─ package.json
│  ├─ backend/             # MCP Hub backend (thin wrapper + hub-only modules)
│  │  ├─ src/
│  │  │  ├─ generator/
│  │  │  ├─ vault/
│  │  │  ├─ deploy/
│  │  │  ├─ admin/
│  │  │  └─ registry/
│  │  └─ package.json
│  ├─ frontend/            # MCP Hub frontend
│  ├─ mcp-server/          # runtime server image/app
│  └─ sandbox-worker/      # isolated code execution workers
├─ docs/
│  ├─ plans/
│  ├─ guides/
│  └─ api/
├─ scripts/
├─ docker-compose.dev.yml
└─ docker-compose.prod.yml
```

---

## 3. Phase Plan (6 -> 7 by adding Phase 2.5)

Note: Phase 0 is setup. The delivery phases are now 7 phases: 1, 2, 2.5, 3, 4, 5, 6.

| Phase | Name | Primary Owner(s) | Duration | Core Deliverable |
|---|---|---|---|---|
| Phase 0 | Workspace and tooling bootstrap | Claude + Codex + Gemini | 2-3 days | runnable monorepo foundation |
| Phase 1 | Skeleton setup | Codex + Gemini | Week 1 | backend/frontend/core/cli skeletons |
| Phase 2 | `@mcp-claw/core` shared engine | Codex | Week 2-3 | parser + IR + codegen + sandbox + autofix in core |
| Phase 2.5 | CLI Agent backend logic | Codex (backend logic) + Gemini (CLI UX) | Week 3-4 | full agent loop with five roles |
| Phase 3 | Config repository + package lifecycle | Codex + Gemini | Week 4 | signed package repository + cloud admin |
| Phase 4 | MCP Runtime cluster + deployment | Codex + Gemini | Week 5 | 13 MCP servers + directory + orchestrator |
| Phase 5 | Governance + monitoring + infrastructure | Codex + Gemini | Week 6 | observability, audit, policy, async infra |
| Phase 6 | Integration, hardening, release | All | Week 7-8 | e2e validation + performance + release pack |

---

## 4. Phase Outputs (Updated)

## Phase 0: Workspace and Tooling
- Root workspace files (`package.json`, `pnpm-workspace.yaml`, lint/test scripts).
- Base Docker Compose for local dependencies.
- CI skeleton for lint/test/typecheck.

Output artifacts:
- `E:\mcp\package.json`
- `E:\mcp\pnpm-workspace.yaml`
- `E:\mcp\docker-compose.dev.yml`

## Phase 1: Skeleton Setup
- Backend NestJS scaffold with health endpoint and base modules.
- Frontend Vue scaffold with shell layout.
- New `core` and `cli` packages with build/test bootstrap.

Output artifacts:
- `E:\mcp\packages\backend\src\app.module.ts`
- `E:\mcp\packages\frontend\src\main.ts`
- `E:\mcp\packages\core\package.json`
- `E:\mcp\packages\cli\package.json`

## Phase 2: Shared Engine (`@mcp-claw/core`)
- Canonical IR + validation schemas.
- Markdown and OpenAPI parsing adapters.
- Code generation service and test contracts.
- Sandbox execution interface + repair loop.
- Token budget checker + package assembly contracts.
- Public core exports for CLI and Hub backend.

Output artifacts:
- `E:\mcp\packages\core\src\index.ts`
- `E:\mcp\packages\core\src\core\mcp-claw-core.ts`
- `E:\mcp\packages\core\src\budget\token-budget.ts`
- `E:\mcp\packages\core\src\autofix\repair-loop.ts`

## Phase 2.5: CLI Agent Backend Logic (New)
- Agent loop implementation (`Plan -> Act -> Observe`).
- Five role backends:
  - Explorer: file scan, docker inspect, endpoint probe, web parse.
  - Architect: API knowledge graph, token budgeting, shard planning.
  - Builder: task assembly + call into core codegen.
  - Tester: sandbox run + auto-fix loop manager.
  - Deployer: compose generation + startup + health checks.
- Multi-model config and routing (Claude/Gemini/DeepSeek).
- Memory/session module for context retention and pruning.

Output artifacts:
- `E:\mcp\packages\cli\src\loop\agent-loop.ts`
- `E:\mcp\packages\cli\src\agents\explorer\*`
- `E:\mcp\packages\cli\src\agents\architect\*`
- `E:\mcp\packages\cli\src\agents\builder\*`
- `E:\mcp\packages\cli\src\agents\tester\*`
- `E:\mcp\packages\cli\src\agents\deployer\*`

## Phase 3: Config Repository and Cloud Admin
- Package publish/download/version APIs.
- Signature verification and SBOM persistence.
- Tenant/admin APIs and API key lifecycle.

Output artifacts:
- `E:\mcp\packages\backend\src\repo\*`
- `E:\mcp\packages\backend\src\admin\*`
- `E:\mcp\packages\backend\src\packages\*`

## Phase 4: Runtime and Deployment
- 13 independent MCP server deployment model.
- Server directory service and health registry.
- Token budget gate for `tools/list`.
- TLS + tenant API key auth through Nginx.
- Deploy orchestrator generating compose/Nginx config.

Output artifacts:
- `E:\mcp\packages\mcp-server\src\mcp\*`
- `E:\mcp\packages\backend\src\registry\*`
- `E:\mcp\packages\backend\src\deploy\*`

## Phase 5: Monitoring and Governance
- Audit logs, redaction rules, policy enforcement.
- Metrics, tracing, queue and storage observability.
- Operations APIs for maintenance and compliance.

Output artifacts:
- `E:\mcp\packages\backend\src\audit\*`
- `E:\mcp\packages\backend\src\monitor\*`
- `E:\mcp\packages\backend\src\policy\*`

## Phase 6: Integration and Release
- End-to-end test suites (CLI + Hub + runtime).
- Security regression and load testing.
- Release runbooks and deployment checklist.
- OSS release packaging for CLI.

Output artifacts:
- `E:\mcp\packages\cli\test\e2e\*`
- `E:\mcp\packages\backend\test\e2e\*`
- `E:\mcp\docs\guides\ops-*.md`
- `E:\mcp\docs\plans\release-checklist.md`

---

## 5. Dependency Flow

1. Phase 1 must complete before Phase 2 and Phase 2.5 development starts.
2. Phase 2 (`core`) is a hard dependency for Phase 2.5 (`cli` backend logic).
3. Phase 3 and Phase 4 can run partially in parallel after core interfaces stabilize.
4. Phase 5 depends on API surfaces from Phase 3 and Phase 4.
5. Phase 6 requires feature freeze on all prior phases.

---

## 6. Milestones and Gates

| Milestone | Target | Gate Criteria |
|---|---|---|
| M1 Skeleton Ready | End Week 1 | backend/frontend/core/cli boot and health checks pass |
| M2 Core Engine Ready | End Week 3 | core parser/codegen/sandbox/autofix tests pass |
| M2.5 CLI Agent Ready | Mid Week 4 | agent loop runs discovery -> deploy in integration test |
| M3 Repo/Admin Ready | End Week 4 | package publish + verify + tenant APIs available |
| M4 Runtime Cluster Ready | End Week 5 | 13 server deployment + directory and auth validated |
| M5 Governance Ready | End Week 6 | audit/metrics/policy checks pass |
| M6 Release Candidate | End Week 8 | e2e, perf, security tests all pass |

---

## 7. Risk Controls (Updated for MCP Claw)

- Risk: core API churn breaks both CLI and Hub.
  - Control: freeze `@mcp-claw/core` public interfaces at end of Phase 2 with contract tests.
- Risk: CLI and Hub diverge in behavior.
  - Control: both consume same core methods; avoid duplicate business logic.
- Risk: multi-model routing instability.
  - Control: deterministic model router, provider-level retries, explicit fallback order.
- Risk: runtime token overflow in large toolsets.
  - Control: enforce budget check and shard planner before deploy.
- Risk: deployment privilege boundaries.
  - Control: keep orchestrator actions auditable and least-privilege.

---

## 8. Immediate Next Actions

1. Execute Phase 2 tasks in `E:\mcp\docs\plans\codex-phase-2-backend.md`.
2. Execute Phase 2.5 tasks in `E:\mcp\docs\plans\codex-phase-2.5-cli-agent.md`.
3. Align frontend and CLI-UI plans to phase interfaces exposed by Phase 2 and 2.5.
4. Freeze shared contracts before scaling Phase 3/4 implementation.
