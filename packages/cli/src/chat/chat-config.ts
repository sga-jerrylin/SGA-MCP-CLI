import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  const apiKey =
    asString(config.get('openrouter.apiKey')) ??
    env.get('OPENROUTER_API_KEY') ??
    process.env.OPENROUTER_API_KEY ??
    '';
  const baseUrl =
    asString(config.get('openrouter.baseUrl')) ??
    env.get('OPENROUTER_BASE_URL') ??
    process.env.OPENROUTER_BASE_URL ??
    DEFAULT_BASE_URL;

  return {
    model,
    apiKey,
    baseUrl,
    workDir
  };
}
