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
    const rawDocs = Array.isArray(report.rawDocs) ? report.rawDocs : [];
    const hasRawDocs = rawDocs.length > 0;
    const llmGenerator = this.deps.llmIrGenerator;
    const ir =
      hasRawDocs && llmGenerator
        ? await llmGenerator.generate(rawDocs.join('\n\n'))
        : buildIRFromDiscovery(report);

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
