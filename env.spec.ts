import { readFileSync } from 'node:fs';

const files = [
  'E:/mcp/.env.example',
  'E:/mcp/packages/backend/.env.example',
  'E:/mcp/packages/cli/.env.example',
];

const required = ['DATABASE_URL=', 'REDIS_URL=', 'MINIO_ENDPOINT=', 'HUB_BASE_URL='];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const key of required) {
    if (!text.includes(key)) {
      throw new Error(`missing ${key} in ${file}`);
    }
  }
}
