import { OpenApiMcpGeneratorAdapter } from './openapi-mcp-generator.adapter';

describe('OpenApiMcpGeneratorAdapter', () => {
  it('maps a tiny OpenAPI document into IR tools', async () => {
    const adapter = new OpenApiMcpGeneratorAdapter();
    const ir = await adapter.toIR({
      openapi: '3.0.0',
      info: {
        title: 'CRM API',
        version: '1.0.0'
      },
      servers: [{ url: 'https://crm.example.com' }],
      paths: {
        '/customers': {
          get: {
            operationId: 'listCustomers',
            summary: 'List customers'
          }
        }
      }
    });

    expect(ir.system.code).toBe('crm-api');
    expect(ir.system.baseUrl).toBe('https://crm.example.com');
    expect(ir.tools[0]).toMatchObject({
      name: 'listCustomers',
      method: 'GET',
      path: '/customers',
      description: 'List customers'
    });
  });
});
