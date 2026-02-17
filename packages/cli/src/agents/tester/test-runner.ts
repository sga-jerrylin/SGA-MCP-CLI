import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
  const result = await execFileAsync(command, args, {
    cwd: options?.cwd,
    timeout: options?.timeout,
    windowsHide: true
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export class TestRunner {
  public constructor(private readonly exec: ExecLike = defaultExec) {}

  public run(cwd: string, command: 'jest' | 'vitest' = 'jest'): Promise<TestRunOutput> {
    return this.exec('pnpm', [command], { cwd, timeout: 180_000 });
  }
}
