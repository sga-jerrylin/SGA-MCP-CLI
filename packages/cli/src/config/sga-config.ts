import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.sga', 'config.yaml');

export type ConfigValue = string | number | boolean | ConfigObj;

export interface ConfigObj {
  [key: string]: ConfigValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class SgaConfig {
  public constructor(private readonly path = DEFAULT_CONFIG_PATH) {}

  public get(key: string): ConfigValue | undefined {
    const config = this.load();
    const parts = key.split('.').filter(Boolean);

    let current: unknown = config;
    for (const part of parts) {
      if (!isRecord(current) || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }

    return current as ConfigValue | undefined;
  }

  public set(key: string, value: string | number | boolean): void {
    const config = this.load();
    const parts = key.split('.').filter(Boolean);
    if (parts.length === 0) {
      throw new Error('Config key must not be empty');
    }

    let current: Record<string, unknown> = config;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      const nextValue = current[part];

      if (!isRecord(nextValue)) {
        current[part] = {};
      }

      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    this.save(config);
  }

  public getAll(): ConfigObj {
    return this.load();
  }

  private load(): ConfigObj {
    if (!existsSync(this.path)) {
      return {};
    }

    const raw = readFileSync(this.path, 'utf8');
    const parsed = yaml.load(raw);
    if (!isRecord(parsed)) {
      return {};
    }

    return parsed as ConfigObj;
  }

  private save(config: ConfigObj): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const serialized = yaml.dump(config, { lineWidth: -1 });
    writeFileSync(this.path, serialized, 'utf8');
  }
}
