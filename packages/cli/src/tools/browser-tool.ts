import { chromium, type Browser } from 'playwright';

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

export class BrowserTool {
  protected async launchBrowser(): Promise<Browser> {
    return chromium.launch({ headless: true });
  }

  public async fetch(url: string, timeoutMs = 30_000): Promise<BrowserFetchResult> {
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
      const openApiUrls = links.filter(isOpenApiLink);

      return {
        url: page.url(),
        html,
        text: normalizeText(extracted.text),
        title: normalizeText(extracted.title),
        links,
        openApiUrls
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
