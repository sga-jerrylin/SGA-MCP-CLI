# Codex Agent Instructions — mcp (mcp-claw CLI monorepo)

## Package Manager: PNPM ONLY

This is a **pnpm workspace** (`pnpm-workspace.yaml` exists at root).

**RULES:**

- ALWAYS use `pnpm` for dependency management. NEVER run `npm install`.
- Install deps: `pnpm --filter mcp-claw add <package>` (package name is `mcp-claw`)
- Install all: `pnpm install`
- Build CLI: `pnpm --filter mcp-claw build`
- Test: `pnpm --filter mcp-claw test`
- Publishing to npm registry is OK with `npm publish` (publish only, not install)

## Project Structure

```
packages/
  cli/          → mcp-claw CLI (package name: "mcp-claw")
  core/         → @sga/core (shared core)
  shared/       → @sga/shared (types)
```

## Build Pipeline

```bash
pnpm --filter mcp-claw build    # tsc → ncc bundle → dist/bundle.js
```

## Common Commands

```bash
# Add a dependency to CLI
pnpm --filter mcp-claw add <pkg>
pnpm --filter mcp-claw add -D <pkg>

# Build and publish
pnpm --filter mcp-claw build
cd packages/cli && npm publish --access public
```
