import { Injectable } from '@nestjs/common';
import { Env, EnvSchema } from './env.schema';

@Injectable()
export class AppConfigService {
  private readonly env: Env;

  constructor(envOverride?: Record<string, string | undefined>) {
    const raw = envOverride ?? process.env;
    const result = EnvSchema.safeParse(raw);
    if (!result.success) {
      const formatted = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment variables:\n${formatted}`);
    }
    this.env = result.data;
  }

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  getAll(): Readonly<Env> {
    return Object.freeze({ ...this.env });
  }
}
