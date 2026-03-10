function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LlmProvider {
  name: string;
  complete(prompt: string): Promise<string>;
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ChatResponse {
  content: string;
  finish_reason: 'stop' | 'tool_calls';
  tool_calls?: ToolCall[];
}

export interface ChatCapableLlmProvider {
  chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<ChatResponse>;
}

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

function extractTextContent(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
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

function extractToolCalls(
  calls:
    | Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>
    | undefined
): ToolCall[] {
  if (!Array.isArray(calls)) {
    return [];
  }

  return calls
    .filter(
      (call) =>
        typeof call?.id === 'string' &&
        (call?.type === 'function' || typeof call?.type === 'undefined') &&
        typeof call?.function?.name === 'string'
    )
    .map((call) => ({
      id: call.id as string,
      type: 'function',
      function: {
        name: call.function?.name as string,
        arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : '{}'
      }
    }));
}

export class OpenRouterProvider implements LlmProvider {
  public name: string;

  public constructor(
    name: string,
    private readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = 'https://openrouter.ai/api/v1'
  ) {
    this.name = name;
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const isMinimaxModel = this.model.toLowerCase().includes('minimax');
    const body = JSON.stringify({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
      })),
      ...(!isMinimaxModel && tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      max_tokens: 8192
    });

    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Bail out early if already aborted before retrying
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120_000);
        // Propagate external abort signal into the internal controller
        signal?.addEventListener('abort', () => controller.abort(), { once: true });
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/mcp-claw',
            'X-Title': 'MCP-Claw'
          },
          body,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }

        if (!response.ok) {
          throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
        }

        const payload = (await response.json()) as OpenRouterChatCompletionResponse;
        const choice = payload.choices?.[0];
        const content = extractTextContent(choice?.message?.content);
        const toolCalls = extractToolCalls(choice?.message?.tool_calls);
        const finishReason: ChatResponse['finish_reason'] =
          toolCalls.length > 0 || choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop';

        return {
          content,
          finish_reason: finishReason,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message;
        // Retry on network errors (timeout, abort, ECONNRESET, etc.)
        if (
          msg.includes('fetch failed') ||
          msg.includes('Timeout') ||
          msg.includes('abort') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ECONNREFUSED')
        ) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('OpenRouter request failed after retries');
  }

  public async complete(prompt: string): Promise<string> {
    const result = await this.chat([{ role: 'user', content: prompt }]);
    return result.content;
  }
}

export interface LlmCompleteRequest {
  provider: string;
  prompt: string;
}

export class LlmClientRouter {
  private readonly providers = new Map<string, LlmProvider>();

  public constructor(providers: LlmProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  public async complete(request: LlmCompleteRequest): Promise<string> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      throw new Error('provider not found');
    }
    return provider.complete(request.prompt);
  }
}
