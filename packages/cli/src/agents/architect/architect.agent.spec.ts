import { ArchitectAgent } from './architect.agent';

describe('ArchitectAgent', () => {
  it('produces IR, shard plan and generated configs', async () => {
    const agent = new ArchitectAgent();

    const result = await agent.run({
      files: [],
      containers: [],
      endpoints: [{ url: 'https://api.example.com/customers', status: 200, body: '{}' }]
    });

    expect(result.ir.tools).toHaveLength(1);
    expect(result.shards).toHaveLength(1);
    expect(result.config.compose).toContain('services');
    expect(result.config.nginx).toContain('server');
  });
});
