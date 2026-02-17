import { HttpFetchTool } from './http-tool';

describe('HttpFetchTool', () => {
  it('fetches api docs and returns status/body', async () => {
    const tool = new HttpFetchTool(
      async () =>
        ({
          status: 200,
          text: async () => 'openapi: 3.0.0'
        }) as Response
    );

    const result = await tool.fetch('https://example.com/openapi.yaml');

    expect(result.status).toBe(200);
    expect(result.body).toContain('openapi');
  });
});
