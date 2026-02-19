import { HubApiClient } from './hub-api-client';

describe('HubApiClient', () => {
  it('push posts payload to /sync/push', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const client = new HubApiClient('https://hub.example.com', fetcher as unknown as typeof fetch, () => 'tok');

    await client.push({ pkg: 'a' });

    expect(fetcher).toHaveBeenCalledWith(
      'https://hub.example.com/sync/push',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer tok' })
      })
    );
  });

  it('pull gets payload from /sync/pull', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: 'world' })
    });
    const client = new HubApiClient('https://hub.example.com', fetcher as unknown as typeof fetch, () => 'tok');

    const data = await client.pull('test-pkg-id');

    expect(fetcher).toHaveBeenCalledWith(
      'https://hub.example.com/sync/pull/test-pkg-id',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer tok' })
      })
    );
    expect(data).toEqual({ hello: 'world' });
  });
});
