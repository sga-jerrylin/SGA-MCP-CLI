export interface ShardPlan {
  id: string;
  port: number;
  tools: string[];
}

export interface ToolCandidate {
  name: string;
  domain?: string;
}

export function planShards(
  tools: ToolCandidate[],
  maxToolsPerShard = 40,
  basePort = 8081
): ShardPlan[] {
  const shards: ShardPlan[] = [];

  for (const tool of tools) {
    let shard = shards.find((item) => item.tools.length < maxToolsPerShard);
    if (!shard) {
      shard = {
        id: `shard-${shards.length + 1}`,
        port: basePort + shards.length,
        tools: []
      };
      shards.push(shard);
    }
    shard.tools.push(tool.name);
  }

  return shards;
}
