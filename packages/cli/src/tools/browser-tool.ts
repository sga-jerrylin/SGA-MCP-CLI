export interface BrowserFetchResult {
  url: string;
  html: string;
  text: string;
  title: string;
  links: string[];
  openApiUrls: string[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isOpenApiLink(link: string): boolean {
  return /(openapi|swagger|api-docs|api\.json|api\.ya?ml)/i.test(link);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      links.push(new URL(match[1], baseUrl).href);
    } catch {
      // skip invalid URLs
    }
  }
  return unique(links);
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeText(match[1]) : '';
}

async function fetchWithNative(url: string, timeoutMs: number): Promise<BrowserFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'mcp-claw/1.0' }
    });
    const html = await response.text();
    const finalUrl = response.url || url;
    const links = extractLinksFromHtml(html, finalUrl);

    return {
      url: finalUrl,
      html,
      text: extractTextFromHtml(html),
      title: extractTitleFromHtml(html),
      links,
      openApiUrls: links.filter(isOpenApiLink)
    };
  } finally {
    clearTimeout(timer);
  }
}

export class BrowserTool {
  protected async launchBrowser(): Promise<any> {
    const { chromium } = await import('playwright');
    return chromium.launch({ headless: true });
  }

  public async fetch(url: string, timeoutMs = 30_000): Promise<BrowserFetchResult> {
    try {
      return await this.fetchWithBrowser(url, timeoutMs);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (
        msg.includes('Executable') ||
        msg.includes('browserType.launch') ||
        msg.includes('Cannot find module')
      ) {
        return fetchWithNative(url, timeoutMs);
      }
      throw error;
    }
  }

  private async fetchWithBrowser(url: string, timeoutMs: number): Promise<BrowserFetchResult> {
    const browser = await this.launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      const html = await page.content();
      const extracted = await page.evaluate(() => {
        const title = document.title || '';
        const hrefs = Array.from(document.querySelectorAll('a[href]'))
          .map((anchor) => (anchor as HTMLAnchorElement).href)
          .filter(Boolean);

        const bodyClone = document.body.cloneNode(true) as HTMLElement | null;
        if (bodyClone) {
          bodyClone
            .querySelectorAll('script,style,nav,header,footer')
            .forEach((node) => node.remove());
        }

        return {
          title,
          text: bodyClone?.innerText ?? '',
          links: hrefs
        };
      });

      const links = unique(extracted.links);

      return {
        url: page.url(),
        html,
        text: normalizeText(extracted.text),
        title: normalizeText(extracted.title),
        links,
        openApiUrls: links.filter(isOpenApiLink)
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
