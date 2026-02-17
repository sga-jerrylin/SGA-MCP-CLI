import type { ShardPlan } from './shard-planner';

export interface RuntimeConfig {
  compose: string;
  nginx: string;
}

export function generateRuntimeConfig(shards: ShardPlan[]): RuntimeConfig {
  const composeLines = ['version: "3.9"', 'services:'];
  for (const shard of shards) {
    composeLines.push(`  ${shard.id}:`);
    composeLines.push('    image: mcp-claw/mcp-server:latest');
    composeLines.push(`    ports: ["${shard.port}:${shard.port}"]`);
  }

  const nginxLines = ['server {', '  listen 443 ssl;'];
  for (const shard of shards) {
    nginxLines.push(`  location /mcp/${shard.id} {`);
    nginxLines.push(`    proxy_pass http://127.0.0.1:${shard.port};`);
    nginxLines.push('  }');
  }
  nginxLines.push('}');

  return {
    compose: `${composeLines.join('\n')}\n`,
    nginx: `${nginxLines.join('\n')}\n`
  };
}
