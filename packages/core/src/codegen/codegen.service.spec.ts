import type { IR } from '../ir/ir';

import { CodegenService } from './codegen.service';

describe('CodegenService', () => {
  it('renders deterministic template files without LLM calls', () => {
    const llm = {
      complete: jest.fn()
    };

    const service = new CodegenService(llm);
    const ir: IR = {
      system: {
        code: 'crm-api',
        baseUrl: 'https://crm.example.com',
        authType: 'none'
      },
      tools: []
    };

    const files = service.render(ir);

    expect(llm.complete).not.toHaveBeenCalled();
    expect(files.map((file) => file.path)).toEqual([
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/http-client.ts',
      'src/server.ts',
      'manifest.json'
    ]);
  });

  it('calls llm.complete and returns parsed generated files', async () => {
    const llm = {
      complete: jest
        .fn()
        .mockResolvedValue(
          [
            '===FILE=== auth.ts',
            'export const auth = true;',
            '===FILE=== client.ts',
            'export const client = true;',
            '===FILE=== tools/listCustomers.ts',
            'export const listCustomers = true;'
          ].join('\n')
        )
    };

    const service = new CodegenService(llm);
    const ir: IR = {
      system: {
        code: 'crm-api',
        baseUrl: 'https://crm.example.com',
        authType: 'none'
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

    const files = await service.generate(ir);

    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(files.map((file) => file.path)).toEqual([
      'auth.ts',
      'client.ts',
      'tools/listCustomers.ts'
    ]);
  });
});
