import { waitHealthy } from './health-checker';

describe('waitHealthy', () => {
  it('reports failed endpoints when health check does not pass', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false });

    const result = await waitHealthy(['http://a', 'http://b'], 2, fetcher as any, () =>
      Promise.resolve()
    );

    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['http://a', 'http://b']);
  });
});
