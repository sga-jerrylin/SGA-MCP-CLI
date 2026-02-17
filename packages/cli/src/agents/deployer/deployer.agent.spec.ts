import { DeployerAgent } from './deployer.agent';

describe('DeployerAgent', () => {
  it('renders compose, runs docker up, and verifies health', async () => {
    const deps = {
      render: jest.fn().mockReturnValue('version: "3.9"\nservices:\n'),
      up: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue({ ok: true, failed: [] })
    };

    const agent = new DeployerAgent(deps as any);
    const result = await agent.run({
      composeFile: 'docker-compose.yml',
      services: [{ name: 's1', image: 'x', port: 8081 }],
      healthUrls: ['http://localhost:8081']
    });

    expect(result.ok).toBe(true);
    expect(deps.up).toHaveBeenCalled();
  });
});
