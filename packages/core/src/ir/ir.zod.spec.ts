import { IrSchema } from './ir.zod';

describe('IrSchema', () => {
  it('accepts valid IR', () => {
    const parsed = IrSchema.parse({
      system: {
        code: 'erp',
        baseUrl: 'https://erp.example.com',
        authType: 'api-key'
      },
      tools: [
        {
          name: 'create_order',
          description: 'Create order',
          method: 'POST',
          path: '/orders',
          needsConfirmation: true,
          isAsync: true,
          params: []
        }
      ]
    });

    expect(parsed.system.authType).toBe('api-key');
  });

  it('rejects invalid auth type', () => {
    expect(() =>
      IrSchema.parse({
        system: {
          code: 'erp',
          baseUrl: 'https://erp.example.com',
          authType: 'basic'
        },
        tools: []
      })
    ).toThrow();
  });
});
