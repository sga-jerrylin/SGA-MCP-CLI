import { generateRuntimeConfig } from './config-generator';

describe('generateRuntimeConfig', () => {
  it('renders docker compose and nginx config from shard plan', () => {
    const generated = generateRuntimeConfig([
      { id: 'shard-1', port: 8081, tools: ['tool_a', 'tool_b'] },
      { id: 'shard-2', port: 8082, tools: ['tool_c'] }
    ]);

    expect(generated.compose).toContain('shard-1');
    expect(generated.compose).toContain('8081:8081');
    expect(generated.nginx).toContain('location /mcp/shard-1');
    expect(generated.nginx).toContain('proxy_pass http://127.0.0.1:8082');
  });
});
