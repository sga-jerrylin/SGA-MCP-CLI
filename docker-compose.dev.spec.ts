import { readFileSync } from 'node:fs';

const text = readFileSync('E:/mcp/docker-compose.dev.yml', 'utf8');
for (const token of ['postgres:', 'redis:', 'minio:']) {
  if (!text.includes(token)) {
    throw new Error(`missing service: ${token}`);
  }
}
for (const token of ['healthcheck:', 'POSTGRES_DB', 'redis-cli', 'minio/minio']) {
  if (!text.includes(token)) {
    throw new Error(`missing expected config token: ${token}`);
  }
}
