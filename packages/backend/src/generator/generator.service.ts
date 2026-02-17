import { Injectable } from '@nestjs/common';
import type { PackageBuildResult } from '@mcp-claw/core';
import { McpClawCore } from '@mcp-claw/core';

@Injectable()
export class GeneratorService {
  public constructor(private readonly core: McpClawCore) {}

  public generateFromDoc(content: string): Promise<PackageBuildResult> {
    return this.core.generate({ kind: 'markdown', content });
  }
}
