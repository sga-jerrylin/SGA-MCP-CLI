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

  public async pull(packageId: string): Promise<object> {
    const response = await this.fetcher(`${this.baseUrl}/sync/pull/${packageId}`, {
      method: 'GET'
    });

    return (await response.json()) as object;
  }
}
