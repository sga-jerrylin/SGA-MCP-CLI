import type { LlmClient } from '../codegen/codegen.service';

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export class OpenRouterClient implements LlmClient {
  public constructor(
    private readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string
  ) {}

  public async complete(prompt: string): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/mcp-claw',
        'X-Title': 'MCP-Claw'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as OpenRouterChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();
    }

    return '';
  }
}
