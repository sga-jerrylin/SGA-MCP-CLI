import { SgaConfig } from '../config/sga-config';
import type { ChatConfig } from './chat-types';

const DEFAULT_CHAT_MODEL = 'anthropic/claude-sonnet-4.5';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function loadChatConfig(workDir = process.cwd()): ChatConfig {
  const config = new SgaConfig();
  const model =
    asString(config.get('model.coder')) ??
    asString(config.get('model.default')) ??
    process.env.LLM_CODER_MODEL ??
    DEFAULT_CHAT_MODEL;
  const apiKey =
    asString(config.get('openrouter.apiKey')) ??
    process.env.OPENROUTER_API_KEY ??
    '';
  const baseUrl =
    asString(config.get('openrouter.baseUrl')) ??
    process.env.OPENROUTER_BASE_URL ??
    DEFAULT_BASE_URL;

  return {
    model,
    apiKey,
    baseUrl,
    workDir
  };
}

