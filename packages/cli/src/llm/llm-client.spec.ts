import { LlmClientRouter, type LlmProvider } from './llm-client';

describe('LlmClientRouter', () => {
  it('routes completion to selected provider', async () => {
    const claude: LlmProvider = {
      name: 'claude',
      complete: jest.fn().mockResolvedValue('claude-response')
    };

    const router = new LlmClientRouter([claude]);
    const result = await router.complete({ provider: 'claude', prompt: 'hello' });

    expect(result).toBe('claude-response');
    expect(claude.complete).toHaveBeenCalledWith('hello');
  });

  it('throws for missing provider', async () => {
    const router = new LlmClientRouter([]);
    await expect(router.complete({ provider: 'gemini', prompt: 'hi' })).rejects.toThrow(
      'provider not found'
    );
  });
});
