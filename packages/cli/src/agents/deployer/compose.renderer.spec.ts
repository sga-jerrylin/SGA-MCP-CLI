import { renderCompose } from './compose.renderer';

describe('renderCompose', () => {
  it('renders deterministic yaml', () => {
    const yaml = renderCompose([
      { name: 'shard-1', image: 'mcp:latest', port: 8081 },
      { name: 'shard-2', image: 'mcp:latest', port: 8082 }
    ]);

    expect(yaml).toContain('services:');
    expect(yaml).toContain('shard-1:');
    expect(yaml).toContain('"8082:8082"');
  });
});
