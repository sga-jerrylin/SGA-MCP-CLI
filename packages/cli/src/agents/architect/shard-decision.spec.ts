import { shardTools } from './shard-decision';

describe('shardTools', () => {
  it('splits tools into token-bounded shards', () => {
    const shards = shardTools([
      { name: 'tool-a', domain: 'erp', tokenCost: 3000 },
      { name: 'tool-b', domain: 'erp', tokenCost: 4000 },
      { name: 'tool-c', domain: 'crm', tokenCost: 3000 }
    ], 7000);

    expect(shards).toHaveLength(2);
    expect(shards[0]?.tools).toEqual(['tool-a', 'tool-b']);
    expect(shards[1]?.tools).toEqual(['tool-c']);
  });
});
