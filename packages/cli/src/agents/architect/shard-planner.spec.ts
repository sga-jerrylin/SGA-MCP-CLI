import { planShards } from './shard-planner';

describe('planShards', () => {
  it('splits tools into shards with max 40 tools each', () => {
    const tools = Array.from({ length: 95 }, (_, index) => ({
      name: `tool_${index + 1}`,
      domain: index % 2 === 0 ? 'erp' : 'crm'
    }));

    const shards = planShards(tools, 40);

    expect(shards).toHaveLength(3);
    expect(Math.max(...shards.map((shard) => shard.tools.length))).toBeLessThanOrEqual(40);
    expect(shards[0]?.tools[0]).toBe('tool_1');
  });
});
