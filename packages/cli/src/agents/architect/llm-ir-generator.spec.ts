import { LlmIrGenerator } from './llm-ir-generator';

describe('LlmIrGenerator', () => {
  it('parses a plain JSON response', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue(
        JSON.stringify({
          system: {
            code: 'billing_api',
            baseUrl: 'https://api.example.com',
            authType: 'bearer'
          },
          tools: [
            {
              name: 'list_invoices',
              description: 'List invoices',
              method: 'GET',
              path: '/invoices',
              params: [],
              needsConfirmation: false,
              isAsync: false
            }
          ]
        })
      )
    };

    const generator = new LlmIrGenerator(llm);
    const ir = await generator.generate('GET /invoices');

    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(ir.system.code).toBe('billing_api');
    expect(ir.system.authType).toBe('bearer');
    expect(ir.tools[0]?.name).toBe('list_invoices');
  });

  it('parses JSON wrapped in markdown fences', async () => {
    const llm = {
      complete: jest
        .fn()
        .mockResolvedValue(
          '```json\n{"system":{"code":"crm","baseUrl":"https://crm.example.com","authType":"none"},"tools":[]}\n```'
        )
    };

    const generator = new LlmIrGenerator(llm);
    const ir = await generator.generate('# API docs');

    expect(ir.system.code).toBe('crm');
    expect(ir.system.baseUrl).toBe('https://crm.example.com');
  });

  it('throws on invalid JSON from LLM', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue('this-is-not-json')
    };

    const generator = new LlmIrGenerator(llm);
    await expect(generator.generate('broken')).rejects.toThrow('LLM returned invalid JSON');
  });

  it('passes full doc up to 80 000 chars to LLM', async () => {
    const longDoc = 'GET /endpoint\n'.repeat(6000);
    const captured: string[] = [];
    const llm = {
      complete: jest.fn().mockImplementation(async (prompt: string) => {
        captured.push(prompt);
        return '{}';
      })
    };

    const generator = new LlmIrGenerator(llm);
    await generator.generate(longDoc);

    expect(captured[0]?.length ?? 0).toBeGreaterThan(79_900);
  });
});
