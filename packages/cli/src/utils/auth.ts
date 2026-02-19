import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface CliAuthConfig {
  token?: string;
  marketUrl?: string;
}

const DEFAULT_MARKET_URL = 'https://market.sga.dev';
const CONFIG_PATH = path.join(os.homedir(), '.sga', 'config.json');

function readConfig(): CliAuthConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const candidate = parsed as Partial<CliAuthConfig>;
    return {
      token: typeof candidate.token === 'string' ? candidate.token : undefined,
      marketUrl: typeof candidate.marketUrl === 'string' ? candidate.marketUrl : undefined
    };
  } catch {
    return {};
  }
}

function writeConfig(config: CliAuthConfig): void {
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function getToken(): string | null {
  const token = readConfig().token?.trim();
  return token && token.length > 0 ? token : null;
}

export function saveToken(token: string, marketUrl: string): void {
  const next: CliAuthConfig = {
    token: token.trim(),
    marketUrl: marketUrl.trim() || DEFAULT_MARKET_URL
  };
  writeConfig(next);
}

export function clearToken(): void {
  const current = readConfig();
  const next: CliAuthConfig = {
    marketUrl: current.marketUrl?.trim() || DEFAULT_MARKET_URL
  };
  writeConfig(next);
}

export function getMarketUrl(): string {
  const marketUrl = readConfig().marketUrl?.trim();
  return marketUrl && marketUrl.length > 0 ? marketUrl : DEFAULT_MARKET_URL;
}

