import { checkTokenBudget, type IR } from '@mcp-claw/core';

import type { ExplorerReport } from '../explorer/explorer.agent';
import { generateRuntimeConfig } from './config-generator';
import { buildIRFromDiscovery } from './ir-generator';
import { planShards, type ShardPlan } from './shard-planner';

export interface ArchitectResult {
  ir: IR;
  shards: ShardPlan[];
  config: {
    compose: string;
    nginx: string;
  };
  budget: {
    estimated: number;
    overBudget: boolean;
    threshold: number;
  };
}

export class ArchitectAgent {
  public async run(report: ExplorerReport): Promise<ArchitectResult> {
    const ir = buildIRFromDiscovery(report);
    const shards = planShards(
      ir.tools.map((tool) => ({ name: tool.name, domain: 'default' })),
      40
    );
    const config = generateRuntimeConfig(shards);
    const budget = checkTokenBudget(JSON.stringify(ir.tools), 8000);

    return {
      ir,
      shards,
      config,
      budget
    };
  }
}
