import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cli package contract', () => {
  it('includes runtime and test dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      bin?: Record<string, string>;
    };

    expect(pkg.scripts.test).toBe('jest');
    expect(pkg.dependencies['@sga/core']).toBeDefined();
    expect(pkg.dependencies.commander).toBeDefined();
    expect(pkg.dependencies.chalk).toBeDefined();
    expect(pkg.dependencies.ora).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();
    expect(pkg.dependencies.execa).toBeDefined();
    expect(pkg.bin?.['mcp-claw']).toBeDefined();
    expect(pkg.devDependencies.jest).toBeDefined();
    expect(pkg.devDependencies['ts-jest']).toBeDefined();
  });
});
