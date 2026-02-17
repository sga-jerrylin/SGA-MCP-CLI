# Phase 2 Core Migration Note

## What Changed

- Generator business logic moved from backend-internal modules to `@mcp-claw/core`.
- Backend now acts as a thin orchestration layer via `GeneratorService`.
- Core owns parsing, IR, codegen, sandbox orchestration, repair loop, budget checks, and package metadata contracts.

## Backend Impact

- `packages/backend/src/generator/generator.service.ts` delegates to `McpClawCore.generate`.
- Integration coverage ensures backend and core stay contract-compatible.
- Backend keeps API and tenancy concerns; generation internals are shared for Hub + CLI reuse.

## Next Integration Points

- Wire `GeneratorService` into backend controllers in Phase 3+ endpoints.
- Replace mocked `McpClawCore` provider with real dependency graph once runtime adapters are available.
