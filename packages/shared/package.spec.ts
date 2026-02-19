import { existsSync, readFileSync } from 'node:fs';

const manifests = [
  'E:/mcp/packages/core/package.json',
  'E:/mcp/packages/cli/package.json',
  'E:/mcp/packages/backend/package.json',
  'E:/mcp/packages/shared/package.json',
];

for (const file of manifests) {
  if (!existsSync(file)) {
    throw new Error(`missing manifest: ${file}`);
  }
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  if (!pkg.name?.startsWith('@sga/')) {
    throw new Error(`invalid package name: ${file}`);
  }
  if (!pkg.scripts?.build || !pkg.scripts?.test) {
    throw new Error(`missing build/test scripts: ${file}`);
  }
}
