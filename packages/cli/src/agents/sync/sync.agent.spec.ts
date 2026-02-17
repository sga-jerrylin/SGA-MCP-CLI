import { SyncAgent } from './sync.agent';

describe('SyncAgent', () => {
  it('syncUp delegates to client.push', async () => {
    const client = {
      push: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue({})
    };

    const agent = new SyncAgent(client as any);
    await agent.syncUp({ a: 1 });

    expect(client.push).toHaveBeenCalledWith({ a: 1 });
  });

  it('syncDown delegates to client.pull', async () => {
    const client = {
      push: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue({ ok: true })
    };

    const agent = new SyncAgent(client as any);
    const result = await agent.syncDown('test-pkg-id');

    expect(client.pull).toHaveBeenCalledWith('test-pkg-id');
    expect(result).toEqual({ ok: true });
  });
});
