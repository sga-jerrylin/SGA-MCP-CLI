import type { IR } from '../ir/ir';
import { buildCodegenPrompt } from './prompt-builder';

describe('buildCodegenPrompt', () => {
  it('builds strict generation prompt with IR/tool details', () => {
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
          params: [
            {
              name: 'tenantId',
              type: 'string',
              required: true,
              description: 'Tenant identifier'
            },
            {
              name: 'limit',
              type: 'number',
              required: false,
              description: 'Maximum number of records'
            }
          ]
        }
      ]
    };

    const prompt = buildCodegenPrompt(ir);

    expect(prompt).toContain('Task: Generate a TypeScript Node.js MCP server package');
    expect(prompt).toContain('- system.code: crm-api');
    expect(prompt).toContain('- system.baseUrl: https://crm.example.com');
    expect(prompt).toContain('- system.authType: oauth2');
    expect(prompt).toContain('- name: listCustomers');
    expect(prompt).toContain('- method: GET');
    expect(prompt).toContain('- path: /customers');
    expect(prompt).toContain(
      '- param: tenantId, type: string, required, description: Tenant identifier'
    );
    expect(prompt).toContain(
      '- param: limit, type: number, optional, description: Maximum number of records'
    );
    expect(prompt).toContain('===FILE===');
    expect(prompt).toContain('src/index.ts');
    expect(prompt).toContain('STRICT OUTPUT FORMAT (MANDATORY)');
    expect(prompt).toContain('TypeScript OOM Guard (MANDATORY for src/server.ts)');
    expect(prompt).toContain('function toInputSchema(schema: unknown): Tool["inputSchema"]');
    expect(prompt).toContain('NEVER use: zodToJsonSchema(mySchema) as Tool["inputSchema"]');
  });
});
