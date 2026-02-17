import type { SandboxPort, SandboxRunResult } from '@mcp-claw/core';

export class TesterSandboxAdapter {
  public constructor(private readonly sandbox: Pick<SandboxPort, 'runTests'>) {}

  public execute(files: Array<{ path: string; content: string }>): Promise<SandboxRunResult> {
    return this.sandbox.runTests({ files, timeoutMs: 30 * 60 * 1000 });
  }
}
