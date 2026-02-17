import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MASTER_KEY_FILE: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  LLM_CODER_MODEL: z.string().default('openai/gpt-5.2-codex'),
  LLM_PARSER_MODEL: z.string().default('anthropic/claude-haiku-4.5'),
  LLM_AGENT_MODEL: z.string().default('anthropic/claude-sonnet-4.5')
});

export type Env = z.infer<typeof EnvSchema>;
