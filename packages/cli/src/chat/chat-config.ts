import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { SgaConfig } from '../config/sga-config';
import {
  getApiKeyEnvName,
  getBaseUrlForProvider,
  getProviderForModel,
  type ModelProvider
} from '../llm/provider-routing';
import type { ChatConfig } from './chat-types';

const DEFAULT_CHAT_MODEL = 'google/gemini-3-flash-preview';

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function loadEnvFile(startDir: string, maxLevels = 5): Map<string, string> {
  let currentDir = resolve(startDir);
  for (let level = 0; level <= maxLevels; level += 1) {
    const envPath = resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      const values = new Map<string, string>();
      for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) values.set(match[1], match[2]);
      }
      return values;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return new Map();
}

export function loadChatConfig(workDir = process.cwd()): ChatConfig {
  const env = loadEnvFile(workDir);
  const config = new SgaConfig();

  const model =
    asString(config.get('model.coder')) ??
    asString(config.get('model.default')) ??
    env.get('LLM_CODER_MODEL') ??
    process.env.LLM_CODER_MODEL ??
    DEFAULT_CHAT_MODEL;

  const provider: ModelProvider = getProviderForModel(model);
  const baseUrl = getBaseUrlForProvider(provider);

  const envKeyName = getApiKeyEnvName(provider);
  const apiKey =
    provider === 'coding-plan'
      ? (asString(config.get('coding-plan.apiKey')) ??
        env.get(envKeyName) ??
        process.env[envKeyName] ??
        '')
      : (asString(config.get('openrouter.apiKey')) ??
        env.get(envKeyName) ??
        process.env[envKeyName] ??
        '');

  return { model, apiKey, baseUrl, workDir, provider };
}
