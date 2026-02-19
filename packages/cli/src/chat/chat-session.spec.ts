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
        content: '分析完成，已准备下一步。',
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

    await session.send('我把 Stripe API 文档放在 ./docs/ 下了，帮我看看');

    expect(chat).toHaveBeenCalledTimes(2);
    expect(readFolder).toHaveBeenCalledWith({ path: './docs' });
    expect(write).toHaveBeenCalledWith('[read_folder] ...\n');
    expect(write).toHaveBeenCalledWith('分析完成，已准备下一步。\n');

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
      content: '好的，我先读取文档。',
      finish_reason: 'stop'
    });
    const write = jest.fn();
    const session = new ChatSession(config, {
      llm: { chat },
      output: { write }
    });

    await session.send('开始');

    expect(chat).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('好的，我先读取文档。\n');
  });
});
