import { checkTokenBudget, type IR } from '@sga/core';

import type { ExplorerReport } from '../explorer/explorer.agent';
import { generateRuntimeConfig } from './config-generator';
import { buildIRFromDiscovery } from './ir-generator';
import type { LlmIrGenerator } from './llm-ir-generator';
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

export interface ArchitectDeps {
  llmIrGenerator?: Pick<LlmIrGenerator, 'generate'>;
}

export class ArchitectAgent {
  public constructor(private readonly deps: ArchitectDeps = {}) {}

  public async run(report: ExplorerReport): Promise<ArchitectResult> {
    let ir: IR;
    if (report.rawDocs?.length && this.deps.llmIrGenerator) {
      ir = await this.deps.llmIrGenerator.generate(report.rawDocs.join('\n\n'));
    } else {
      ir = buildIRFromDiscovery(report);
    }

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
