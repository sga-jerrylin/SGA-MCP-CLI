import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type ExecLike = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
) => Promise<unknown>;

async function defaultExec(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<unknown> {
  return execAsync(`${command} ${args.join(' ')}`, {
    cwd: options?.cwd,
    timeout: options?.timeout,
    windowsHide: true
  });
}

/** Package managers in preference order */
const PM_CANDIDATES = ['pnpm', 'yarn', 'npm'] as const;

async function detectPm(exec: ExecLike): Promise<string> {
  for (const pm of PM_CANDIDATES) {
    try {
      await exec(pm, ['--version'], { timeout: 5_000 });
      return pm;
    } catch {
      // not available, try next
    }
  }
  return 'npm';
}

export class DependencyInstaller {
  public constructor(private readonly exec: ExecLike = defaultExec) {}

  public async install(cwd: string): Promise<void> {
    const pm = await detectPm(this.exec);
    await this.exec(pm, ['install'], { cwd, timeout: 120_000 });
  }
}
