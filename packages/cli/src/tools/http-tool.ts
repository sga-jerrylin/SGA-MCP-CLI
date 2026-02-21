export interface HttpFetchResult {
  url: string;
  status: number;
  body: string;
}

export interface HttpRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpRequestResult {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpFetchTool {
  public constructor(private readonly fetchImpl: FetchLike = fetch) {}

  public async fetch(url: string, timeoutMs = 5000): Promise<HttpFetchResult> {
    const response = await this.request({
      url,
      method: 'GET',
      headers: {
        accept: 'application/json,application/yaml,text/plain,*/*'
      },
      timeoutMs
    });

    return {
      url: response.url,
      status: response.status,
      body: response.body
    };
  }

  public async request(input: HttpRequestInput): Promise<HttpRequestResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 5000);

    try {
      const response = await this.fetchImpl(input.url, {
        method: input.method ?? 'GET',
        signal: controller.signal,
        headers: input.headers,
        body: input.body
      });

      const headers: Record<string, string> = {};
      response.headers?.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        url: response.url || input.url,
        status: response.status,
        statusText: response.statusText || '',
        headers,
        body: await response.text()
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
