import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('core tsconfig', () => {
  it('enables strict declarations and build output', () => {
    const tsconfig = JSON.parse(readFileSync(join(__dirname, 'tsconfig.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.declaration).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('node');
  });

  it('has dedicated build config', () => {
    const build = JSON.parse(readFileSync(join(__dirname, 'tsconfig.build.json'), 'utf8')) as {
      extends: string;
      compilerOptions: Record<string, unknown>;
      exclude: string[];
    };

    expect(build.extends).toBe('./tsconfig.json');
    expect(build.compilerOptions.noEmit).toBeUndefined();
    expect(build.exclude).toContain('**/*.spec.ts');
  });
});
