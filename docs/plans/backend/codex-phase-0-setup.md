# Phase 0 (Backend, Codex) - Setup Plan (Contract-First Update)

Goal: establish a contract-first monorepo baseline for MCP Claw ecosystem so backend/CLI/frontend implementations all align with a single API source of truth:
- `E:\mcp\packages\shared\api-contract.yaml`
- `E:\mcp\packages\shared\types\api.ts`

Scope:
1. Monorepo initialization with 5 packages: `core`, `cli`, `backend`, `frontend`, `shared`.
2. Local dev infra with PostgreSQL, Redis, MinIO.
3. Database schema design aligned to OpenAPI models.
4. Shared package build/distribution setup.
5. Contract-driven mock server generation for frontend parallel work.
6. Contract test foundation for backend OpenAPI compliance.
7. Unified lint/format and git hooks.

Conventions:
1. Each task is 2-5 minutes and TDD-first.
2. TDD loop: write test -> run (fail) -> implement -> run (pass) -> commit.
3. All file paths are absolute Windows paths.
4. Commit messages follow Conventional Commits.

---

## Task 0.1: Initialize root workspace manifest and scripts

Files:
- Modify/Create: `E:\mcp\package.json`
- Create: `E:\mcp\package.spec.ts`

TDD:
1. Write `package.spec.ts` to assert root scripts include `lint`, `format`, `typecheck`, `test`, `contract:test`.
2. Run: `pnpm -C E:\mcp test -- package.spec.ts` (expect FAIL).
3. Implement root scripts and workspace metadata.
4. Re-run test (expect PASS).
5. Commit: `chore(workspace): initialize root manifest and scripts`

Key code:
```json
{
  "name": "mcp-claw",
  "private": true,
  "scripts": {
    "lint": "pnpm -r lint",
    "format": "prettier --check .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "contract:test": "pnpm -C packages/backend test:contract"
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp run lint --help
```
Expected: script help output, exit code `0`.

---

## Task 0.2: Configure pnpm workspace for 5 required packages

Files:
- Modify/Create: `E:\mcp\pnpm-workspace.yaml`
- Create: `E:\mcp\pnpm-workspace.spec.ts`

TDD:
1. Write test asserting workspace includes `packages/core`, `packages/cli`, `packages/backend`, `packages/frontend`, `packages/shared`.
2. Run tests (expect FAIL).
3. Implement workspace globs.
4. Re-run tests (expect PASS).
5. Commit: `chore(workspace): configure pnpm workspace packages`

Key code:
```yaml
packages:
  - 'packages/core'
  - 'packages/cli'
  - 'packages/backend'
  - 'packages/frontend'
  - 'packages/shared'
```

Verify:
```powershell
pnpm -C E:\mcp m ls -r --depth -1
```
Expected: package list includes all 5 package names.

---

## Task 0.3: Create package skeleton directories and entry files

Files:
- Create: `E:\mcp\packages\core\src\index.ts`
- Create: `E:\mcp\packages\cli\src\index.ts`
- Create: `E:\mcp\packages\backend\src\main.ts`
- Create: `E:\mcp\packages\frontend\src\main.ts`
- Create: `E:\mcp\packages\shared\src\index.ts`
- Create: `E:\mcp\scripts\verify-skeleton.ps1`

TDD:
1. Write script/test checking all required skeleton files exist.
2. Run script (expect FAIL).
3. Create directories/files.
4. Re-run script (expect PASS).
5. Commit: `chore(workspace): add package skeletons`

Key code:
```powershell
$required = @(
  'E:\mcp\packages\core\src\index.ts',
  'E:\mcp\packages\cli\src\index.ts',
  'E:\mcp\packages\backend\src\main.ts',
  'E:\mcp\packages\frontend\src\main.ts',
  'E:\mcp\packages\shared\src\index.ts'
)
$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing.Count -gt 0) { throw "Missing skeleton files: $($missing -join ', ')" }
```

Verify:
```powershell
powershell -ExecutionPolicy Bypass -File E:\mcp\scripts\verify-skeleton.ps1
```
Expected: `Skeleton verification passed`.

---

## Task 0.4: Add base TypeScript config with shared path aliases

Files:
- Modify/Create: `E:\mcp\tsconfig.base.json`
- Create: `E:\mcp\tsconfig.base.spec.ts`

TDD:
1. Write test for strict mode and path aliases (`@mcp-claw/shared`, `@mcp-claw/shared/*`).
2. Run tests (expect FAIL).
3. Implement base tsconfig.
4. Re-run tests (expect PASS).
5. Commit: `build(ts): add base tsconfig with shared aliases`

Key code:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@mcp-claw/shared": ["packages/shared/types/api.ts"],
      "@mcp-claw/shared/*": ["packages/shared/*"]
    }
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp -r exec tsc -p E:\mcp\tsconfig.base.json --showConfig
```
Expected: JSON output includes `paths.@mcp-claw/shared`.

---

## Task 0.5: Define per-package manifests for core/cli/backend/frontend/shared

Files:
- Create/Modify: `E:\mcp\packages\core\package.json`
- Create/Modify: `E:\mcp\packages\cli\package.json`
- Create/Modify: `E:\mcp\packages\backend\package.json`
- Create/Modify: `E:\mcp\packages\frontend\package.json`
- Modify: `E:\mcp\packages\shared\package.json`
- Create: `E:\mcp\packages\shared\package.spec.ts`

TDD:
1. Write test ensuring package names use `@mcp-claw/*` and scripts include `build` and `test`.
2. Run tests (expect FAIL).
3. Implement manifests.
4. Re-run tests (expect PASS).
5. Commit: `chore(packages): align package manifests`

Key code:
```json
{
  "name": "@mcp-claw/shared",
  "version": "0.1.0",
  "main": "dist/types/api.js",
  "types": "dist/types/api.d.ts",
  "files": ["dist", "api-contract.yaml"]
}
```

Verify:
```powershell
pnpm -C E:\mcp m ls -r --depth -1 | findstr /i "@mcp-claw/shared"
```
Expected: one line with `@mcp-claw/shared`.

---

## Task 0.6: Configure Docker Compose dev stack (PostgreSQL/Redis/MinIO)

Files:
- Create/Modify: `E:\mcp\docker-compose.dev.yml`
- Create: `E:\mcp\docker-compose.dev.spec.ts`

TDD:
1. Write spec asserting services `postgres`, `redis`, `minio` exist with healthchecks.
2. Run tests (expect FAIL).
3. Implement compose file.
4. Re-run tests (expect PASS).
5. Commit: `feat(devops): add docker compose dev dependencies`

Key code:
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mcp_claw_dev
      POSTGRES_USER: mcp
      POSTGRES_PASSWORD: mcp_dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp -d mcp_claw_dev"]
  redis:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
```

Verify:
```powershell
docker compose -f E:\mcp\docker-compose.dev.yml config
```
Expected: normalized compose output including three services.

---

## Task 0.7: Add environment templates for local development

Files:
- Create: `E:\mcp\.env.example`
- Create: `E:\mcp\packages\backend\.env.example`
- Create: `E:\mcp\packages\cli\.env.example`
- Create: `E:\mcp\env.spec.ts`

TDD:
1. Write test that required variables exist (`DATABASE_URL`, `REDIS_URL`, `MINIO_ENDPOINT`, `HUB_BASE_URL`).
2. Run tests (expect FAIL).
3. Add env templates.
4. Re-run tests (expect PASS).
5. Commit: `chore(env): add local env templates`

Key code:
```dotenv
DATABASE_URL=postgres://mcp:mcp_dev@localhost:5432/mcp_claw_dev
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
HUB_BASE_URL=http://localhost:3000/api
```

Verify:
```powershell
rg -n "DATABASE_URL|REDIS_URL|MINIO_ENDPOINT|HUB_BASE_URL" E:\mcp\.env.example E:\mcp\packages\backend\.env.example E:\mcp\packages\cli\.env.example
```
Expected: all variable names found.

---

## Task 0.8: Harden `@mcp-claw/shared` build configuration

Files:
- Create: `E:\mcp\packages\shared\tsconfig.json`
- Create: `E:\mcp\packages\shared\src\index.ts`
- Create: `E:\mcp\packages\shared\types\index.ts`
- Modify: `E:\mcp\packages\shared\package.json`
- Create: `E:\mcp\packages\shared\tsconfig.spec.ts`

TDD:
1. Write test for declaration output and export entry.
2. Run tests (expect FAIL).
3. Implement TS build configuration.
4. Re-run tests (expect PASS).
5. Commit: `build(shared): configure shared package compilation`

Key code:
```json
{
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": false
  },
  "include": ["types/**/*.ts", "src/**/*.ts"]
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\shared build
```
Expected: `dist/types/api.d.ts` generated.

---

## Task 0.9: Add OpenAPI contract linting pipeline

Files:
- Create: `E:\mcp\.spectral.yaml`
- Modify: `E:\mcp\package.json`
- Create: `E:\mcp\packages\shared\api-contract.spec.ts`

TDD:
1. Write failing test for malformed OpenAPI root fields.
2. Run `contract:lint` (expect FAIL on invalid fixture).
3. Add Spectral rules and root script.
4. Re-run (expect PASS on real contract file).
5. Commit: `test(contract): add openapi lint pipeline`

Key code:
```yaml
extends: ["spectral:oas"]
rules:
  operation-operationId:
    severity: warn
  no-$ref-siblings: error
```

Verify:
```powershell
pnpm -C E:\mcp exec spectral lint E:\mcp\packages\shared\api-contract.yaml
```
Expected: `No results with a severity of 'error'`.

---

## Task 0.10: Create database schema mapping from contract models

Files:
- Create: `E:\mcp\packages\backend\src\db\migrations\0001_init_from_contract.sql`
- Create: `E:\mcp\packages\backend\src\db\migrations\0001_init_from_contract.spec.ts`

TDD:
1. Write test asserting migration includes tables for OpenAPI models:
   - `users`, `projects`, `generate_runs`, `artifacts`, `mcp_servers`, `packages`, `tenants`, `api_keys`, `audit_logs`.
2. Run tests (expect FAIL).
3. Implement migration SQL.
4. Re-run tests (expect PASS).
5. Commit: `feat(db): add initial schema mapped from api contract`

Key code:
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','parsing','generating','testing','fixing','done','failed')),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('markdown','openapi','auto')),
  tool_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- 0001_init_from_contract.spec.ts
```
Expected: `PASS`.

---

## Task 0.11: Add enum consistency checks between OpenAPI and DB schema

Files:
- Create: `E:\mcp\packages\backend\test\contract\enum-consistency.spec.ts`
- Create: `E:\mcp\scripts\extract-openapi-enums.ts`

TDD:
1. Write test comparing extracted OpenAPI enums vs SQL check constraints for key entities.
2. Run tests (expect FAIL).
3. Implement enum extraction utility.
4. Re-run tests (expect PASS).
5. Commit: `test(contract): enforce enum consistency between openapi and sql`

Key code:
```ts
// Ensure RunStatus enum in OpenAPI == DB constraint for generate_runs.status
expect(openApiEnums.RunStatus.sort()).toEqual(dbEnums.generate_runs_status.sort());
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- enum-consistency.spec.ts
```
Expected: `PASS`.

---

## Task 0.12: Generate mock server from `api-contract.yaml`

Files:
- Create: `E:\mcp\scripts\mock\start-mock-server.ps1`
- Create: `E:\mcp\scripts\mock\README.md`
- Modify: `E:\mcp\package.json`
- Create: `E:\mcp\scripts\mock\mock-server.spec.ts`

TDD:
1. Write test expecting mock endpoint `/api/auth/me` responds with contract-compliant envelope.
2. Run test (expect FAIL).
3. Implement Prism-based mock startup script.
4. Re-run tests (expect PASS).
5. Commit: `feat(mock): generate and run openapi mock server`

Key code:
```powershell
# E:\mcp\scripts\mock\start-mock-server.ps1
npx @stoplight/prism-cli mock E:\mcp\packages\shared\api-contract.yaml --port 4010
```

Verify:
```powershell
powershell -ExecutionPolicy Bypass -File E:\mcp\scripts\mock\start-mock-server.ps1
```
Expected: Prism startup log with `Listening on http://127.0.0.1:4010`.

---

## Task 0.13: Add backend contract test infrastructure (OpenAPI conformance)

Files:
- Create: `E:\mcp\packages\backend\test\contract\contract-runner.ts`
- Create: `E:\mcp\packages\backend\test\contract\contract-runner.spec.ts`
- Modify: `E:\mcp\packages\backend\package.json`

TDD:
1. Write failing spec for one endpoint response shape mismatch.
2. Run `test:contract` (expect FAIL).
3. Implement contract test runner (Dredd/Schemathesis wrapper + reporter).
4. Re-run (expect PASS on compliant fixtures).
5. Commit: `test(contract): add backend openapi conformance runner`

Key code:
```json
{
  "scripts": {
    "test:contract": "tsx test/contract/contract-runner.ts"
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend run test:contract
```
Expected: summary with passed/failed counts and non-zero exit on violation.

---

## Task 0.14: Seed initial contract tests for critical APIs

Files:
- Create: `E:\mcp\packages\backend\test\contract\auth.contract.spec.ts`
- Create: `E:\mcp\packages\backend\test\contract\generator.contract.spec.ts`
- Create: `E:\mcp\packages\backend\test\contract\sync.contract.spec.ts`

TDD:
1. Write tests for:
   - `POST /auth/login` response envelope.
   - `POST /generator/projects/{projectId}/start` accepted response.
   - `POST /sync/push` and `GET /sync/pull/{packageId}` shape/status.
2. Run tests (expect FAIL).
3. Implement minimal stubs/mappers in backend test harness.
4. Re-run tests (expect PASS).
5. Commit: `test(contract): add auth generator sync baseline suites`

Key code:
```ts
import type { ApiResponse, SyncPushResponse } from '@mcp-claw/shared';

type PushApi = ApiResponse<SyncPushResponse>;
expect(body.code).toBe(0);
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- test/contract/sync.contract.spec.ts
```
Expected: `PASS`.

---

## Task 0.15: Add unified ESLint config for workspace

Files:
- Create: `E:\mcp\.eslintrc.cjs`
- Create: `E:\mcp\.eslintignore`
- Create: `E:\mcp\eslint.spec.ts`
- Modify: `E:\mcp\package.json`

TDD:
1. Write spec checking ESLint config exists and includes TS parser/plugin.
2. Run tests (expect FAIL).
3. Implement root eslint config.
4. Re-run tests (expect PASS).
5. Commit: `chore(lint): add unified eslint configuration`

Key code:
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
};
```

Verify:
```powershell
pnpm -C E:\mcp exec eslint E:\mcp\packages\shared\types\api.ts
```
Expected: no fatal parsing errors.

---

## Task 0.16: Add unified Prettier configuration

Files:
- Create: `E:\mcp\.prettierrc.json`
- Create: `E:\mcp\.prettierignore`
- Modify: `E:\mcp\package.json`
- Create: `E:\mcp\prettier.spec.ts`

TDD:
1. Write spec ensuring prettier config exists and root `format` scripts use it.
2. Run tests (expect FAIL).
3. Implement config and scripts.
4. Re-run tests (expect PASS).
5. Commit: `chore(format): add prettier configuration`

Key code:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

Verify:
```powershell
pnpm -C E:\mcp exec prettier --check E:\mcp\packages\shared\types\api.ts
```
Expected: `All matched files use Prettier code style!`.

---

## Task 0.17: Enable Husky pre-commit hooks

Files:
- Create: `E:\mcp\.husky\pre-commit`
- Modify: `E:\mcp\package.json`
- Create: `E:\mcp\husky.spec.ts`

TDD:
1. Write spec ensuring pre-commit hook runs lint-staged.
2. Run tests (expect FAIL).
3. Implement husky installation scripts.
4. Re-run tests (expect PASS).
5. Commit: `chore(git): enable husky pre-commit hook`

Key code:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
```

Verify:
```powershell
Get-Content E:\mcp\.husky\pre-commit
```
Expected: file contains `pnpm lint-staged`.

---

## Task 0.18: Configure lint-staged and commit-msg checks

Files:
- Modify: `E:\mcp\package.json`
- Create: `E:\mcp\.husky\commit-msg`
- Create: `E:\mcp\commitlint.config.cjs`
- Create: `E:\mcp\lint-staged.spec.ts`

TDD:
1. Write test ensuring staged TS/MD/YAML files are linted/formatted.
2. Run tests (expect FAIL).
3. Implement lint-staged + commitlint config.
4. Re-run tests (expect PASS).
5. Commit: `chore(git): add lint-staged and conventional commit guard`

Key code:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js}": ["eslint --fix", "prettier --write"],
    "*.{md,yml,yaml,json}": ["prettier --write"]
  }
}
```

Verify:
```powershell
pnpm -C E:\mcp exec lint-staged --help
```
Expected: lint-staged help output.

---

## Phase 0 Exit Criteria

1. Workspace includes exactly the five required packages and builds.
2. `@mcp-claw/shared` builds and exports contract-linked types.
3. Local infra boots with PostgreSQL, Redis, MinIO healthy.
4. OpenAPI mock server can run from `api-contract.yaml`.
5. Backend has contract-test foundation and baseline suites.
6. Lint/format/hook chain is active for all contributors.
7. Schema and enum checks are aligned with OpenAPI source of truth.
