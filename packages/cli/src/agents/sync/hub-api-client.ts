export class HubApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  public async push(payload: object): Promise<void> {
    await this.fetcher(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  public async pull(): Promise<object> {
    const response = await this.fetcher(`${this.baseUrl}/sync/pull`, {
      method: 'GET'
    });

    return (await response.json()) as object;
  }
}
