import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ExecLike = (command: string, args: string[], options?: { cwd?: string; timeout?: number }) => Promise<unknown>;

async function defaultExec(command: string, args: string[], options?: { cwd?: string; timeout?: number }): Promise<unknown> {
  return execFileAsync(command, args, {
    cwd: options?.cwd,
    timeout: options?.timeout,
    windowsHide: true
  });
}

export class DependencyInstaller {
  public constructor(private readonly exec: ExecLike = defaultExec) {}

  public async install(cwd: string): Promise<void> {
    await this.exec('pnpm', ['install'], { cwd, timeout: 120_000 });
  }
}
