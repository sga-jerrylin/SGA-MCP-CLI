import { HubApiClient } from './hub-api-client';

describe('HubApiClient', () => {
  it('push posts payload to /sync/push', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const client = new HubApiClient('https://hub.example.com', fetcher as any);

    await client.push({ pkg: 'a' });

    expect(fetcher).toHaveBeenCalledWith(
      'https://hub.example.com/sync/push',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('pull gets payload from /sync/pull', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hello: 'world' })
    });
    const client = new HubApiClient('https://hub.example.com', fetcher as any);

    const data = await client.pull();

    expect(fetcher).toHaveBeenCalledWith(
      'https://hub.example.com/sync/pull',
      expect.objectContaining({ method: 'GET' })
    );
    expect(data).toEqual({ hello: 'world' });
  });
});
