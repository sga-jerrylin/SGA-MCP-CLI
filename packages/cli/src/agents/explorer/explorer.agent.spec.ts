import { ExplorerAgent } from './explorer.agent';

describe('ExplorerAgent', () => {
  it('aggregates filesystem, docker and http observations', async () => {
    const agent = new ExplorerAgent({
      fsTool: {
        glob: jest.fn().mockResolvedValue(['C:/repo/openapi.json'])
      },
      dockerTool: {
        listContainers: jest
          .fn()
          .mockResolvedValue([{ id: 'abc', image: 'postgres', status: 'Up' }])
      },
      httpTool: {
        fetch: jest
          .fn()
          .mockResolvedValue({ url: 'https://example.com/openapi', status: 200, body: '{}' })
      }
    });

    const report = await agent.run({ root: 'C:/repo', urls: ['https://example.com/openapi'] });

    expect(report.files).toEqual(['C:/repo/openapi.json']);
    expect(report.containers).toHaveLength(1);
    expect(report.endpoints[0]?.status).toBe(200);
  });
});
