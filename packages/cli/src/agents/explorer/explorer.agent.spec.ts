import { resolve } from 'node:path';

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
    expect(report.rawDocs).toContain('{}');
  });

  it('adds browser page text to rawDocs when browserTool is provided', async () => {
    const agent = new ExplorerAgent({
      fsTool: {
        glob: jest.fn().mockResolvedValue([])
      },
      dockerTool: {
        listContainers: jest.fn().mockResolvedValue([])
      },
      httpTool: {
        fetch: jest.fn().mockResolvedValue({
          url: 'https://example.com/docs',
          status: 200,
          body: ''
        })
      },
      browserTool: {
        fetch: jest.fn().mockResolvedValue({
          url: 'https://example.com/docs',
          html: '<html><body>API reference</body></html>',
          text: 'API reference',
          title: 'Docs',
          links: ['https://example.com/openapi.json'],
          openApiUrls: ['https://example.com/openapi.json']
        })
      }
    });

    const report = await agent.run({ root: 'C:/repo', urls: ['https://example.com/docs'] });

    expect(report.browserPages).toHaveLength(1);
    expect(report.rawDocs).toContain('API reference');
    expect(report.endpoints[0]).toEqual({
      url: 'https://example.com/docs',
      status: 200,
      body: '<html><body>API reference</body></html>'
    });
  });

  it('reads markdown files into rawDocs', async () => {
    const readmePath = resolve(__dirname, '..', '..', 'fixtures', 'sample-api', 'README.md');

    const agent = new ExplorerAgent({
      fsTool: {
        glob: jest.fn().mockResolvedValue([readmePath])
      },
      dockerTool: {
        listContainers: jest.fn().mockResolvedValue([])
      },
      httpTool: {
        fetch: jest.fn().mockResolvedValue({
          url: 'https://example.com',
          status: 200,
          body: ''
        })
      }
    });

    const report = await agent.run({ root: resolve(__dirname, '..', '..', 'fixtures'), urls: [] });

    expect(report.rawDocs?.some((doc) => doc.includes('# Sample API'))).toBe(true);
  });
});
