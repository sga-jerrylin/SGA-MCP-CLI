import { existsSync, readFileSync } from 'node:fs';

const basePath = 'E:/mcp/tsconfig.base.json';
if (!existsSync(basePath)) {
  throw new Error('missing tsconfig.base.json');
}
const base = JSON.parse(readFileSync(basePath, 'utf8')) as {
  compilerOptions?: {
    strict?: boolean;
    paths?: Record<string, string[]>;
  };
};
if (!base.compilerOptions?.strict) {
  throw new Error('strict mode must be enabled');
}
if (!base.compilerOptions?.paths?.['@mcp-claw/shared']) {
  throw new Error('missing @mcp-claw/shared path alias');
}

const packageTsconfigs = [
  'E:/mcp/packages/core/tsconfig.json',
  'E:/mcp/packages/cli/tsconfig.json',
  'E:/mcp/packages/backend/tsconfig.json',
  'E:/mcp/packages/shared/tsconfig.json',
];

for (const file of packageTsconfigs) {
  if (!existsSync(file)) {
    throw new Error(`missing package tsconfig: ${file}`);
  }
  const cfg = JSON.parse(readFileSync(file, 'utf8')) as { extends?: string };
  if (!cfg.extends) {
    throw new Error(`tsconfig must extend base: ${file}`);
  }
}
