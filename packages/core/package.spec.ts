import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('core package manifest', () => {
  it('declares package metadata and exports', () => {
    const manifestPath = join(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string;
      version: string;
      main: string;
      types: string;
      exports: Record<string, { types: string; default: string }>;
      scripts: Record<string, string>;
    };

    expect(pkg.name).toBe('@mcp-claw/core');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.types).toBe('dist/index.d.ts');
    expect(pkg.exports['.']).toEqual({
      types: './dist/index.d.ts',
      default: './dist/index.js'
    });
    expect(pkg.scripts.test).toBe('jest');
  });
});
