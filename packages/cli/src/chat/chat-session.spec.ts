jest.mock('../commands/generate.command', () => ({
  generateCommand: jest.fn().mockResolvedValue(undefined),
  isUrl: (value: string) => /^https?:\/\//i.test(value)
}));

import type { ChatConfig } from './chat-types';
import { ChatSession } from './chat-session';

describe('ChatSession', () => {
  const config: ChatConfig = {
    model: 'anthropic/claude-sonnet-4.5',
    apiKey: 'test-key',
    baseUrl: 'https://openrouter.ai/api/v1',
    workDir: process.cwd()
  };

  it('runs tool-calls loop and continues conversation', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finish_reason: 'tool_calls',
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
      })
      .mockResolvedValueOnce({
        content: 'Done, ready for next step.',
        finish_reason: 'stop'
      });
    const readFolder = jest.fn().mockResolvedValue('{"fileCount":2}');
    const write = jest.fn();

    const session = new ChatSession(config, {
      llm: { chat },
      output: { write },
      toolHandlers: {
        read_folder: readFolder
      }
    });

    await session.send('I put the Stripe API docs in ./docs/, take a look');

    expect(chat).toHaveBeenCalledTimes(2);
    expect(readFolder).toHaveBeenCalledWith({ path: './docs' });
    expect(write).toHaveBeenCalledWith('[read_folder] ...\n');
    expect(write).toHaveBeenCalledWith('Done, ready for next step.\n');

    const firstCallMessages = chat.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    const systemPrompt = firstCallMessages[0]?.content ?? '';
    expect(systemPrompt).toContain(`cwd: ${config.workDir}`);
    expect(systemPrompt).toContain(`platform: ${process.platform}`);
    expect(systemPrompt).toMatch(/time: \d{4}-\d{2}-\d{2}T/);
    expect(systemPrompt).toContain('MCP Protocol Specification');
    expect(systemPrompt).toContain('Authentication Patterns');

    const secondCallMessages = chat.mock.calls[1]?.[0] as Array<{
      role: string;
      tool_call_id?: string;
    }>;
    expect(
      secondCallMessages.some(
        (message) => message.role === 'tool' && message.tool_call_id === 'call_1'
      )
    ).toBe(true);
  });

  it('stops immediately when model returns final response', async () => {
    const chat = jest.fn().mockResolvedValue({
      content: 'OK, let me read the docs first.',
      finish_reason: 'stop'
    });
    const write = jest.fn();
    const session = new ChatSession(config, {
      llm: { chat },
      output: { write }
    });

    await session.send('start');

    expect(chat).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('OK, let me read the docs first.\n');
  });

  it('dispatches test_integration tool', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_test_integration',
            type: 'function',
            function: {
              name: 'test_integration',
              arguments: '{"base_url":"https://api.x.com"}'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        content: 'integration checked',
        finish_reason: 'stop'
      });
    const write = jest.fn();
    const testIntegration = jest.fn().mockResolvedValue('{"passed":true}');

    const session = new ChatSession(config, {
      llm: { chat },
      output: { write },
      toolHandlers: {
        test_integration: testIntegration
      }
    });

    await session.send('test integration');

    expect(testIntegration).toHaveBeenCalledWith({ base_url: 'https://api.x.com' });
    expect(write).toHaveBeenCalledWith('[test_integration] ...\n');
  });

  it('dispatches publish_mcp tool', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_publish',
            type: 'function',
            function: {
              name: 'publish_mcp',
              arguments: '{}'
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        content: 'published',
        finish_reason: 'stop'
      });
    const write = jest.fn();
    const publishMcp = jest.fn().mockResolvedValue('{"status":"ok"}');

    const session = new ChatSession(config, {
      llm: { chat },
      output: { write },
      toolHandlers: {
        publish_mcp: publishMcp
      }
    });

    await session.send('publish it');

    expect(publishMcp).toHaveBeenCalledWith({});
    expect(write).toHaveBeenCalledWith('[publish_mcp] ...\n');
  });
});
