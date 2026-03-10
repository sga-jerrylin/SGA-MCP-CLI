export type ModelProvider = 'openrouter' | 'coding-plan';

/** Aliyun Coding Plan supported model IDs */
export const CODING_PLAN_MODEL_IDS = new Set([
  'qwen3-coder-plus',
  'qwen3-coder-next',
  'qwen3-max',
  'qwen3.5-plus',
  'glm-5',
  'glm-4.7',
  'kimi-k2.5',
  'MiniMax-M2.5'
]);

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const CODING_PLAN_BASE_URL = 'https://coding.dashscope.aliyuncs.com/v1';

export function getProviderForModel(modelId: string): ModelProvider {
  return CODING_PLAN_MODEL_IDS.has(modelId) ? 'coding-plan' : 'openrouter';
}

export function getBaseUrlForProvider(provider: ModelProvider): string {
  return provider === 'coding-plan' ? CODING_PLAN_BASE_URL : OPENROUTER_BASE_URL;
}

/** Config key in ~/.sga/config.yaml */
export function getApiKeyConfigKey(provider: ModelProvider): string {
  return provider === 'coding-plan' ? 'coding-plan.apiKey' : 'openrouter.apiKey';
}

/** Environment variable name for the provider's API key */
export function getApiKeyEnvName(provider: ModelProvider): string {
  return provider === 'coding-plan' ? 'CODING_PLAN_API_KEY' : 'OPENROUTER_API_KEY';
}

/** CLI prompt text when asking user to enter API key */
export function getKeyPromptText(provider: ModelProvider): string {
  return provider === 'coding-plan'
    ? '  输入阿里云 Coding Plan API Key (sk-sp-...): '
    : '  Enter OpenRouter API Key (sk-or-...): ';
}

/** Hint shown above the key prompt */
export function getKeyHintText(provider: ModelProvider): string {
  return provider === 'coding-plan'
    ? '  国内模型 — 获取 Coding Plan key: https://bailian.console.aliyun.com/'
    : '  海外模型 — 获取 OpenRouter key: https://openrouter.ai/settings/keys';
}
