import { DockerInspectTool } from './docker-tool';

describe('DockerInspectTool', () => {
  it('parses docker ps json lines', async () => {
    const tool = new DockerInspectTool(async () => ({
      stdout: [
        '{"ID":"abc","Image":"postgres:16","Status":"Up 1 hour"}',
        '{"ID":"def","Image":"redis:7","Status":"Up 2 hours"}'
      ].join('\n')
    }));

    const containers = await tool.listContainers();

    expect(containers).toEqual([
      { id: 'abc', image: 'postgres:16', status: 'Up 1 hour' },
      { id: 'def', image: 'redis:7', status: 'Up 2 hours' }
    ]);
  });
});
