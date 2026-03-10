jest.mock('../commands/generate.command', () => ({
  generateCommand: jest.fn().mockResolvedValue({ root: '/tmp/generated-mcp' }),
  isUrl: (value: string) => /^https?:\/\//i.test(value)
}));

jest.mock('../commands/publish.command', () => ({
  publishCommand: jest.fn().mockResolvedValue({
    name: 'mcp-server-demo',
    version: '1.0.0',
    marketUrl: 'http://localhost:5100'
  })
}));

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { publishCommand } from '../commands/publish.command';
import type { ChatConfig } from './chat-types';
import { ChatSession } from './chat-session';

describe('ChatSession', () => {
  const config: ChatConfig = {
    model: 'anthropic/claude-sonnet-4.5',
    apiKey: 'test-key',
    baseUrl: 'https://openrouter.ai/api/v1',
    workDir: process.cwd(),
    provider: 'openrouter'
  };

  function writtenText(write: jest.Mock): string {
    return write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
  }

  function createToolLlm(toolName: string, argumentsJson: string): jest.Mock {
    return jest
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: `call_${toolName}`,
            type: 'function',
            function: {
              name: toolName,
              arguments: argumentsJson
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        content: 'done',
        finish_reason: 'stop'
      });
  }

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

    const output = writtenText(write);
    expect(output).toContain('read_folder');
    expect(output).toContain('Done, ready for next step.');

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
    const output = writtenText(write);
    expect(output).toContain('OK, let me read the docs first.');
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
    const output = writtenText(write);
    expect(output).toContain('test_integration');
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
    const output = writtenText(write);
    expect(output).toContain('publish_mcp');
  });

  it('blocks publish_mcp when strict integration gate is not satisfied', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-publish-block-'));
    const session = new ChatSession({ ...config, workDir });

    try {
      const resultJson = await (
        session as unknown as { publishMcp: (args: Record<string, unknown>) => Promise<string> }
      ).publishMcp({
        dir: workDir
      });
      const result = JSON.parse(resultJson) as { error?: string };
      expect(result.error).toContain('Publish blocked');
      expect(publishCommand).not.toHaveBeenCalled();
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('allows publish_mcp only after all tools passed in integration test', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-publish-pass-'));
    const session = new ChatSession({ ...config, workDir });

    (session as unknown as { lastIntegrationDir?: string }).lastIntegrationDir = workDir;
    (
      session as unknown as {
        lastIntegrationSummary?: { passed?: boolean; allToolsPassed?: boolean };
      }
    ).lastIntegrationSummary = { passed: true, allToolsPassed: true };

    try {
      const resultJson = await (
        session as unknown as { publishMcp: (args: Record<string, unknown>) => Promise<string> }
      ).publishMcp({
        dir: workDir
      });
      const result = JSON.parse(resultJson) as { status?: string; packageUrl?: string };
      expect(result.status).toBe('ok');
      expect(result.packageUrl).toContain('/repository');
      expect(publishCommand).toHaveBeenCalledWith({}, workDir);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('rolls back history on LLM error', async () => {
    const chat = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({
        content: 'recovered',
        finish_reason: 'stop'
      });
    const write = jest.fn();

    const session = new ChatSession(config, {
      llm: { chat },
      output: { write }
    });

    await expect(session.send('first')).rejects.toThrow('Network timeout');
    // History should be rolled back — next send should work cleanly
    await session.send('second');
    expect(chat).toHaveBeenCalledTimes(2);
    const output = writtenText(write);
    expect(output).toContain('recovered');
  });

  it('handles write_file tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-write-'));
    const chat = createToolLlm('write_file', '{"path":"./out/config.json","content":"abc"}');
    const write = jest.fn();
    const fsTool = {
      glob: jest.fn().mockResolvedValue([]),
      readFile: jest.fn().mockResolvedValue(''),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        fsTool
      }
    );

    await session.send('write file');

    expect(fsTool.writeFile).toHaveBeenCalledWith(resolve(workDir, './out/config.json'), 'abc');
    const output = writtenText(write);
    expect(output).toContain('write_file');
    expect(output).toContain('bytes written');

    rmSync(workDir, { recursive: true, force: true });
  });

  it('handles search_files tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-search-'));
    const chat = createToolLlm('search_files', '{"pattern":"token","path":".","glob":"*.txt"}');
    const write = jest.fn();
    const targetFile = resolve(workDir, 'a.txt');
    const fsTool = {
      glob: jest.fn().mockResolvedValue([targetFile]),
      readFile: jest.fn().mockResolvedValue('line1\ntoken here\nanother token'),
      writeFile: jest.fn().mockResolvedValue(undefined)
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        fsTool
      }
    );

    await session.send('search files');

    expect(fsTool.glob).toHaveBeenCalledWith(resolve(workDir, '.'), ['*.txt']);
    const output = writtenText(write);
    expect(output).toContain('search_files');
    expect(output).toContain('2 matches');

    rmSync(workDir, { recursive: true, force: true });
  });

  it('handles read_pdf tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-pdf-'));
    const pdfPath = resolve(workDir, 'docs.pdf');
    const chat = createToolLlm('read_pdf', `{"path":"${pdfPath.replace(/\\/g, '\\\\')}"}`);
    const write = jest.fn();
    const pdfTool = {
      extract: jest.fn().mockResolvedValue('PDF CONTENT')
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        pdfTool
      }
    );

    // ensure existsSync(path) passes
    writeFileSync(pdfPath, 'dummy');

    await session.send('read pdf');

    expect(pdfTool.extract).toHaveBeenCalledWith(pdfPath);
    const output = writtenText(write);
    expect(output).toContain('read_pdf');
    expect(output).toContain('chars extracted');

    rmSync(workDir, { recursive: true, force: true });
  });

  it('handles http_request tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-http-'));
    const chat = createToolLlm(
      'http_request',
      '{"url":"https://api.example.com/health","method":"GET","timeout_ms":1000}'
    );
    const write = jest.fn();
    const httpTool = {
      request: jest.fn().mockResolvedValue({
        url: 'https://api.example.com/health',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}'
      })
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        httpTool
      }
    );

    await session.send('http request');

    expect(httpTool.request).toHaveBeenCalled();
    const output = writtenText(write);
    expect(output).toContain('http_request');
    expect(output).toContain('HTTP 200');

    rmSync(workDir, { recursive: true, force: true });
  });

  it('handles crawl_docs tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-crawl-'));
    const chat = createToolLlm(
      'crawl_docs',
      '{"start_url":"https://docs.example.com/start","max_pages":2,"link_pattern":"/docs"}'
    );
    const write = jest.fn();
    const browserTool = {
      fetch: jest
        .fn()
        .mockResolvedValueOnce({
          url: 'https://docs.example.com/start',
          title: 'Start',
          text: 'start text',
          html: '',
          links: ['https://docs.example.com/docs/page1', 'https://external.com/ignore'],
          openApiUrls: []
        })
        .mockResolvedValueOnce({
          url: 'https://docs.example.com/docs/page1',
          title: 'Page 1',
          text: 'page text',
          html: '',
          links: [],
          openApiUrls: []
        })
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        browserTool
      }
    );

    await session.send('crawl docs');

    expect(browserTool.fetch).toHaveBeenCalledTimes(2);
    const output = writtenText(write);
    expect(output).toContain('crawl_docs');
    expect(output).toContain('2 pages');

    rmSync(workDir, { recursive: true, force: true });
  });

  it('handles discover_docs tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-discover-'));
    const originalSearchUrl = process.env.SEARCH_ENGINE_URL;
    process.env.SEARCH_ENGINE_URL = 'https://search.example.com/query';

    const chat = createToolLlm(
      'discover_docs',
      '{"query":"Stripe API documentation","max_results":2}'
    );
    const write = jest.fn();
    const httpTool = {
      request: jest.fn().mockResolvedValue({
        url: 'https://search.example.com/query?q=Stripe%20API%20documentation&limit=2',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          results: [
            {
              title: 'Stripe Docs',
              url: 'https://docs.stripe.com/api',
              snippet: 'Official API docs'
            },
            { title: 'Stripe Dev', url: 'https://stripe.dev', snippet: 'Developer hub' }
          ]
        })
      })
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        httpTool
      }
    );

    try {
      await session.send('discover docs');

      expect(httpTool.request).toHaveBeenCalled();
      const output = writtenText(write);
      expect(output).toContain('discover_docs');
      expect(output).toContain('2 results found');
    } finally {
      if (originalSearchUrl === undefined) {
        delete process.env.SEARCH_ENGINE_URL;
      } else {
        process.env.SEARCH_ENGINE_URL = originalSearchUrl;
      }
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('handles sga_search tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-sga-search-'));
    const originalSearchUrl = process.env.SEARCH_ENGINE_URL;
    process.env.SEARCH_ENGINE_URL = 'http://43.139.167.250:8888';

    const chat = createToolLlm(
      'sga_search',
      '{"q":"Stripe API documentation","preset":"general","limit":3,"sort":"time","depth":"basic"}'
    );
    const write = jest.fn();
    const httpTool = {
      request: jest.fn().mockResolvedValue({
        url: 'http://43.139.167.250:8888/v1/agent/search?q=Stripe%20API%20documentation',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'ok',
          total_results: 2,
          suggestions: ['stripe webhook docs'],
          results: [
            {
              title: 'Stripe API reference',
              url: 'https://docs.stripe.com/api',
              content: 'Official Stripe API documentation content',
              published_date: '2026-02-01',
              domain: 'docs.stripe.com'
            },
            {
              title: 'Stripe developer docs',
              url: 'https://stripe.dev',
              content: 'Developer docs hub'
            }
          ]
        })
      })
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        httpTool
      }
    );

    try {
      await session.send('search docs');
      expect(httpTool.request).toHaveBeenCalled();
      const output = writtenText(write);
      expect(output).toContain('sga_search');
      expect(output).toContain('2 results');
    } finally {
      if (originalSearchUrl === undefined) {
        delete process.env.SEARCH_ENGINE_URL;
      } else {
        process.env.SEARCH_ENGINE_URL = originalSearchUrl;
      }
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('handles parse_openapi tool', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'chat-session-openapi-'));
    const chat = createToolLlm(
      'parse_openapi',
      '{"source":"https://api.example.com/openapi.json","max_endpoints":10}'
    );
    const write = jest.fn();
    const httpTool = {
      request: jest.fn().mockResolvedValue({
        url: 'https://api.example.com/openapi.json',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'Example API',
            version: '1.0.0',
            description: 'Example description'
          },
          servers: [{ url: 'https://api.example.com' }],
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer' }
            },
            schemas: {
              User: { type: 'object' }
            }
          },
          paths: {
            '/users': {
              get: {
                operationId: 'listUsers',
                summary: 'List users',
                responses: {
                  '200': { description: 'ok' }
                }
              },
              post: {
                operationId: 'createUser',
                requestBody: {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                },
                responses: {
                  '200': { description: 'ok' }
                }
              }
            }
          }
        })
      })
    };

    const session = new ChatSession(
      { ...config, workDir },
      {
        llm: { chat },
        output: { write },
        httpTool
      }
    );

    try {
      await session.send('parse openapi');
      expect(httpTool.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.example.com/openapi.json' })
      );
      const output = writtenText(write);
      expect(output).toContain('parse_openapi');
      expect(output).toContain('2 endpoints, bearer');
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
