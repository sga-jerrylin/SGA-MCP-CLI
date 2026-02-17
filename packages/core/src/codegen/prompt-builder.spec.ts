import type { IR } from '../ir/ir';
import { buildCodegenPrompt } from './prompt-builder';

describe('buildCodegenPrompt', () => {
  it('builds deterministic sections from IR', () => {
    const ir: IR = {
      system: {
        code: 'crm-api',
        baseUrl: 'https://crm.example.com',
        authType: 'oauth2'
      },
      tools: [
        {
          name: 'listCustomers',
          description: 'List customers',
          method: 'GET',
          path: '/customers',
          needsConfirmation: false,
          isAsync: false,
          params: []
        }
      ]
    };

    const prompt = buildCodegenPrompt(ir);

    expect(prompt).toContain('System: crm-api');
    expect(prompt).toContain('BaseURL: https://crm.example.com');
    expect(prompt).toContain('AuthType: oauth2');
    expect(prompt).toContain('Tools: listCustomers');
  });
});
