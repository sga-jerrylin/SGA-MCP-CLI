import { withTimeout } from './sandbox-port';

describe('sandbox-port helpers', () => {
  it('rejects when operation exceeds timeout', async () => {
    await expect(
      withTimeout(
        new Promise((resolve) => setTimeout(() => resolve('ok'), 50)),
        5,
        'timeout reached'
      )
    ).rejects.toThrow('timeout reached');
  });

  it('returns result before timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'timeout reached')).resolves.toBe('ok');
  });
});
