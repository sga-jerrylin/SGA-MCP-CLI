import { SandboxHttpAdapter } from './sandbox-http.adapter';

describe('SandboxHttpAdapter', () => {
  it('returns parsed sandbox results for success response', async () => {
    const adapter = new SandboxHttpAdapter(
      'http://sandbox.local',
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          passed: true,
          logs: ['ok'],
          failedTests: []
        })
      }) as unknown as typeof fetch
    );

    const result = await adapter.runTests({ files: [], timeoutMs: 1000 });
    expect(result.passed).toBe(true);
  });

  it('throws when request times out', async () => {
    const delayedFetch = jest
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 50)
          )
      );

    const adapter = new SandboxHttpAdapter(
      'http://sandbox.local',
      delayedFetch as unknown as typeof fetch
    );

    await expect(adapter.runTests({ files: [], timeoutMs: 5 })).rejects.toThrow('SANDBOX_TIMEOUT');
  });
});
