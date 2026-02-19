import { BrowserTool } from './browser-tool';

describe('BrowserTool', () => {
  it('returns fetched url and normalized visible text', async () => {
    const goto = jest.fn().mockResolvedValue(undefined);
    const content = jest.fn().mockResolvedValue('<html><body>raw html</body></html>');
    const evaluate = jest.fn().mockResolvedValue({
      title: ' API Docs ',
      text: '\n User API   reference \n',
      links: ['https://example.com/openapi.json']
    });
    const url = jest.fn().mockReturnValue('https://example.com/docs');

    const page = { goto, content, evaluate, url };
    const closeContext = jest.fn().mockResolvedValue(undefined);
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: closeContext
    };
    const closeBrowser = jest.fn().mockResolvedValue(undefined);
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      close: closeBrowser
    };

    class TestBrowserTool extends BrowserTool {
      protected async launchBrowser(): Promise<any> {
        return browser;
      }
    }

    const tool = new TestBrowserTool();
    const result = await tool.fetch('https://example.com/docs');

    expect(goto).toHaveBeenCalledWith('https://example.com/docs', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    expect(result.url).toBe('https://example.com/docs');
    expect(result.text).toBe('User API reference');
    expect(result.title).toBe('API Docs');
    expect(result.html).toContain('raw html');
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it('filters openApiUrls from discovered links', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html></html>'),
      evaluate: jest.fn().mockResolvedValue({
        title: 'Docs',
        text: 'Docs body',
        links: [
          'https://example.com/docs',
          'https://example.com/openapi.yaml',
          'https://example.com/swagger-ui',
          'https://example.com/api-docs',
          'https://example.com/spec/api.json',
          'https://example.com/docs'
        ]
      }),
      url: jest.fn().mockReturnValue('https://example.com/docs')
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      close: jest.fn().mockResolvedValue(undefined)
    };

    class TestBrowserTool extends BrowserTool {
      protected async launchBrowser(): Promise<any> {
        return browser;
      }
    }

    const result = await new TestBrowserTool().fetch('https://example.com/docs');

    expect(result.links).toHaveLength(5);
    expect(result.openApiUrls).toEqual([
      'https://example.com/openapi.yaml',
      'https://example.com/swagger-ui',
      'https://example.com/api-docs',
      'https://example.com/spec/api.json'
    ]);
  });
});
