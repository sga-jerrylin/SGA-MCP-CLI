import { getToken } from '../../utils/auth';

export class HubApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly tokenProvider: () => string | null = getToken
  ) {}

  public async push(payload: object): Promise<void> {
    const token = this.requireToken();

    await this.fetcher(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  }

  public async pull(packageId: string): Promise<object> {
    const token = this.requireToken();
    const response = await this.fetcher(`${this.baseUrl}/sync/pull/${packageId}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    return (await response.json()) as object;
  }

  private requireToken(): string {
    const token = this.tokenProvider()?.trim();
    if (token) {
      return token;
    }

    throw new Error('未检测到登录凭证，请先执行: mcp-claw login');
  }
}
