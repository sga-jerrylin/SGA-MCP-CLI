import { IntegrationTester } from './integration-tester';

describe('IntegrationTester', () => {
  it('builds server, starts it, calls tools/list, returns report', async () => {
    const mockExec = jest
      .fn()
      .mockResolvedValueOnce({ stdout: 'ok' })
      .mockResolvedValueOnce({ stdout: 'ok' });
    const mockSpawn = jest.fn().mockReturnValue({
      pid: 1234,
      kill: jest.fn(),
      stderr: { on: jest.fn() }
    });
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: { tools: [{ name: 'list_pets' }] }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { content: [] } })
      });

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      fetchFn: mockFetch as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: { API_KEY: 'test-key' }
    });

    expect(result.passed).toBe(true);
    expect(result.toolsFound).toBeGreaterThan(0);
    expect(result.toolsCalled).toContain('list_pets');
  });

  it('returns failed report if build fails', async () => {
    const mockExec = jest.fn().mockRejectedValueOnce(new Error('tsc error'));
    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: jest.fn() as never,
      fetchFn: jest.fn() as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://x.com',
      authEnv: {}
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('tsc error');
  });
});
