import type { IR } from './ir';

describe('IR model', () => {
  it('supports a minimal valid IR value', () => {
    const ir: IR = {
      system: {
        code: 'demo',
        baseUrl: 'https://api.example.com',
        authType: 'bearer'
      },
      tools: [
        {
          name: 'list_users',
          description: 'List users',
          method: 'GET',
          path: '/users',
          needsConfirmation: false,
          isAsync: false,
          params: []
        }
      ]
    };

    expect(ir.system.code).toBe('demo');
    expect(ir.tools[0]?.name).toBe('list_users');
  });
});
