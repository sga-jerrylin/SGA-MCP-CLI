import { HubApiClient } from './hub-api-client';

export class SyncAgent {
  public constructor(private readonly client: Pick<HubApiClient, 'push' | 'pull'>) {}

  public async syncUp(data: object): Promise<void> {
    await this.client.push(data);
  }

  public syncDown(): Promise<object> {
    return this.client.pull();
  }
}
