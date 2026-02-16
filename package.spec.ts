import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('E:/mcp/package.json', 'utf8')) as {
  scripts?: Record<string, string>;
};

const required = ['lint', 'format', 'typecheck', 'test', 'contract:test'];
for (const key of required) {
  if (!pkg.scripts?.[key]) {
    throw new Error(`missing script: ${key}`);
  }
}
