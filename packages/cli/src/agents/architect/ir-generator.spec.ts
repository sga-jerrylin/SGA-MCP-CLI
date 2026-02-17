import { buildIRFromDiscovery } from './ir-generator';

describe('buildIRFromDiscovery', () => {
  it('converts explorer report endpoints into IR tools', () => {
    const ir = buildIRFromDiscovery({
      files: ['C:/repo/openapi.json'],
      containers: [],
      endpoints: [
        { url: 'https://api.example.com/customers', status: 200, body: '{}' },
        { url: 'https://api.example.com/orders', status: 200, body: '{}' }
      ]
    });

    expect(ir.system.baseUrl).toBe('https://api.example.com');
    expect(ir.tools.map((tool) => tool.path)).toEqual(['/customers', '/orders']);
  });
});
