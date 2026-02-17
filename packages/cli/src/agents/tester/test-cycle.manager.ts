import type { TesterSandboxAdapter } from './sandbox.adapter';

export class TestCycleManager {
  public async run(
    files: Array<{ path: string; content: string }>,
    adapter: Pick<TesterSandboxAdapter, 'execute'>
  ): Promise<{
    status: 'passed' | 'failed';
    result: { passed: boolean; logs: string[]; failedTests: string[] };
  }> {
    const result = await adapter.execute(files);
    return result.passed
      ? {
          status: 'passed',
          result
        }
      : {
          status: 'failed',
          result
        };
  }
}
