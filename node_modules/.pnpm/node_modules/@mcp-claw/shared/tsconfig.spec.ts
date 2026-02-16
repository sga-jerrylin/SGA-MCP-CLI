import { existsSync, readFileSync } from 'node:fs';

const tsconfigPath = 'E:/mcp/packages/shared/tsconfig.json';
if (!existsSync(tsconfigPath)) {
  throw new Error('missing shared tsconfig');
}
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as {
  compilerOptions?: { declaration?: boolean; outDir?: string };
  include?: string[];
};
if (!tsconfig.compilerOptions?.declaration) {
  throw new Error('shared tsconfig must enable declaration output');
}
if (!tsconfig.include?.includes('types/**/*.ts') || !tsconfig.include?.includes('src/**/*.ts')) {
  throw new Error('shared tsconfig include patterns are incomplete');
}

if (!existsSync('E:/mcp/packages/shared/types/index.ts')) {
  throw new Error('missing packages/shared/types/index.ts');
}

const pkg = JSON.parse(readFileSync('E:/mcp/packages/shared/package.json', 'utf8')) as {
  scripts?: Record<string, string>;
};
if (!pkg.scripts?.build?.includes('tsc')) {
  throw new Error('shared package build must use tsc');
}
