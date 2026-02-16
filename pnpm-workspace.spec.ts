import { readFileSync } from 'node:fs';

const text = readFileSync('E:/mcp/pnpm-workspace.yaml', 'utf8');
const required = [
  "packages/core",
  "packages/cli",
  "packages/backend",
  "packages/frontend",
  "packages/shared",
];

for (const entry of required) {
  if (!text.includes(entry)) {
    throw new Error(`missing workspace entry: ${entry}`);
  }
}
