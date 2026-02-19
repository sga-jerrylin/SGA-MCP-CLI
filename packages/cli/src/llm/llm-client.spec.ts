import {
  LlmClientRouter,
  OpenRouterProvider,
  type LlmProvider,
  type ToolDefinition
} from './llm-client';

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

describe('OpenRouterProvider.chat', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses tool calls from OpenRouter response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'read_folder',
                    arguments: '{"path":"./docs"}'
                  }
                }
              ]
            }
          }
        ]
      })
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenRouterProvider(
      'openrouter-test',
      'anthropic/claude-sonnet-4.5',
      'test-key'
    );
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'read_folder',
          description: 'Read a folder',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }
      }
    ];

    const result = await provider.chat([{ role: 'user', content: 'scan docs' }], tools);

    expect(result.finish_reason).toBe('tool_calls');
    expect(result.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'read_folder',
          arguments: '{"path":"./docs"}'
        }
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
