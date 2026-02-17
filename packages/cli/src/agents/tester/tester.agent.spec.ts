import { TesterAgent } from './tester.agent';

describe('TesterAgent', () => {
  it('runs tests, parses summary and returns report', async () => {
    const sandboxAdapter = {
      execute: jest.fn().mockResolvedValue({ passed: true, logs: ['ok'], failedTests: [] })
    };
    const runner = {
      run: jest
        .fn()
        .mockResolvedValue({ stdout: 'Tests: 2 passed, 0 failed, 2 total\nLines : 88%' })
    };

    const agent = new TesterAgent({ sandboxAdapter: sandboxAdapter as any, runner: runner as any });
    const result = await agent.run({ root: 'C:/repo', files: [{ path: 'a.ts', content: 'x' }] });

    expect(result.passed).toBe(true);
    expect(result.summary.failed).toBe(0);
    expect(result.coverage.lines).toBe(88);
  });
});
