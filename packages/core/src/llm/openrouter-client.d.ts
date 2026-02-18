import type { LlmClient } from '../codegen/codegen.service';
export declare class OpenRouterClient implements LlmClient {
    private readonly model;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(model: string, apiKey: string, baseUrl: string);
    complete(prompt: string): Promise<string>;
}
