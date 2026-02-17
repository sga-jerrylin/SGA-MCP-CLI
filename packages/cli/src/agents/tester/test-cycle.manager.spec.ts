import { TestCycleManager } from './test-cycle.manager';

describe('TestCycleManager', () => {
  it('maps sandbox result to passed status', async () => {
    const manager = new TestCycleManager();
    const adapter = {
      execute: jest.fn().mockResolvedValue({ passed: true, logs: [], failedTests: [] })
    };

    const result = await manager.run([{ path: 'x.ts', content: 'x' }], adapter as any);
    expect(result.status).toBe('passed');
  });
});
