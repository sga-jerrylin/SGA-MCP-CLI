import { TesterSandboxAdapter } from './sandbox.adapter';

describe('TesterSandboxAdapter', () => {
  it('submits files to sandbox with timeout', async () => {
    const sandbox = {
      runTests: jest.fn().mockResolvedValue({ passed: true, logs: ['ok'], failedTests: [] })
    };
    const adapter = new TesterSandboxAdapter(sandbox as any);

    const result = await adapter.execute([{ path: 'a.ts', content: 'x' }]);

    expect(sandbox.runTests).toHaveBeenCalledWith({
      files: [{ path: 'a.ts', content: 'x' }],
      timeoutMs: 30 * 60 * 1000
    });
    expect(result.passed).toBe(true);
  });
});
