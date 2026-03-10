import type { ModelProvider } from '../llm/provider-routing';

export type { ModelProvider };

export interface ChatConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  workDir: string;
  provider: ModelProvider;
}
