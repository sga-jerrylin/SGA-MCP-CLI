export interface ShardInputTool {
  name: string;
  domain: string;
  tokenCost: number;
}

export interface TokenShard {
  id: string;
  tokenCost: number;
  tools: string[];
}

export function shardTools(tools: ShardInputTool[], maxTokens = 8000): TokenShard[] {
  const shards: TokenShard[] = [];

  for (const tool of tools) {
    let shard = shards.find((candidate) => candidate.tokenCost + tool.tokenCost <= maxTokens);
    if (!shard) {
      shard = {
        id: `shard-${shards.length + 1}`,
        tokenCost: 0,
        tools: []
      };
      shards.push(shard);
    }

    shard.tools.push(tool.name);
    shard.tokenCost += tool.tokenCost;
  }

  return shards;
}
