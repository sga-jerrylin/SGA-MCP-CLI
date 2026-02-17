export interface HttpFetchResult {
  url: string;
  status: number;
  body: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpFetchTool {
  public constructor(private readonly fetchImpl: FetchLike = fetch) {}

  public async fetch(url: string, timeoutMs = 5000): Promise<HttpFetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          accept: 'application/json,application/yaml,text/plain,*/*'
        }
      });

      return {
        url,
        status: response.status,
        body: await response.text()
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
