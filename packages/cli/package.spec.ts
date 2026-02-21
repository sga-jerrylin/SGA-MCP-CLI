import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cli package contract', () => {
  it('includes bundled and test dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      bin?: Record<string, string>;
    };

    expect(pkg.scripts.test).toBe('jest');
    // All deps are in devDependencies (ncc bundles everything into dist/bundle.js)
    expect(pkg.devDependencies['@sga/core']).toBeDefined();
    expect(pkg.devDependencies.commander).toBeDefined();
    expect(pkg.devDependencies.chalk).toBeDefined();
    expect(pkg.devDependencies.ora).toBeDefined();
    expect(pkg.devDependencies.zod).toBeDefined();
    expect(pkg.devDependencies.execa).toBeDefined();
    expect(pkg.bin?.['mcp-claw']).toBeDefined();
    expect(pkg.devDependencies.jest).toBeDefined();
    expect(pkg.devDependencies['ts-jest']).toBeDefined();
  });
});
