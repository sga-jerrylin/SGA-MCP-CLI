import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface TestRunOutput {
  stdout: string;
  stderr?: string;
}

export type ExecLike = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
) => Promise<TestRunOutput>;

async function defaultExec(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<TestRunOutput> {
  const result = await execAsync(`${command} ${args.join(' ')}`, {
    cwd: options?.cwd,
    timeout: options?.timeout,
    windowsHide: true
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}

const PM_CANDIDATES = ['pnpm', 'yarn', 'npx'] as const;

async function detectPm(exec: ExecLike): Promise<string> {
  for (const pm of PM_CANDIDATES) {
    try {
      await exec(pm, ['--version'], { timeout: 5_000 });
      return pm;
    } catch {
      // not available, try next
    }
  }
  return 'npx';
}

function hasTestSetup(cwd: string): boolean {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) {
    return false;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    // Has a test script that's not the default npm placeholder
    if (pkg.scripts?.test && !pkg.scripts.test.includes('no test specified')) {
      return true;
    }
    // Has jest or vitest as a dependency
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(allDeps?.jest || allDeps?.vitest);
  } catch {
    return false;
  }
}

export class TestRunner {
  public constructor(private readonly exec: ExecLike = defaultExec) {}

  public async run(cwd: string, command: 'jest' | 'vitest' = 'jest'): Promise<TestRunOutput> {
    if (hasTestSetup(cwd)) {
      const pm = await detectPm(this.exec);
      return this.exec(pm, [command], { cwd, timeout: 180_000 });
    }

    // No test framework — fall back to compile check
    return this.compileCheck(cwd);
  }

  private async compileCheck(cwd: string): Promise<TestRunOutput> {
    const hasTsConfig = existsSync(join(cwd, 'tsconfig.json'));

    try {
      if (hasTsConfig) {
        // TypeScript project: run tsc --noEmit
        const result = await this.exec('npx', ['tsc', '--noEmit'], { cwd, timeout: 60_000 });
        return {
          stdout: `Compile check PASS (tsc --noEmit)\n${result.stdout}`,
          stderr: result.stderr
        };
      }

      // JavaScript project: try node --check on entry file
      const pkgPath = join(cwd, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { main?: string };
        const entry = pkg.main ?? 'index.js';
        if (existsSync(join(cwd, entry))) {
          const result = await this.exec('node', ['--check', entry], { cwd, timeout: 30_000 });
          return {
            stdout: `Compile check PASS (node --check ${entry})\n${result.stdout}`,
            stderr: result.stderr
          };
        }
      }

      return { stdout: 'No testable files found. Skipping validation.', stderr: '' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        stdout: `Compile check FAIL\n${msg}`,
        stderr: msg
      };
    }
  }
}
