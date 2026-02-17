export interface LlmProvider {
  name: string;
  complete(prompt: string): Promise<string>;
}

export interface LlmCompleteRequest {
  provider: string;
  prompt: string;
}

export class LlmClientRouter {
  private readonly providers = new Map<string, LlmProvider>();

  public constructor(providers: LlmProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  public async complete(request: LlmCompleteRequest): Promise<string> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      throw new Error('provider not found');
    }
    return provider.complete(request.prompt);
  }
}
