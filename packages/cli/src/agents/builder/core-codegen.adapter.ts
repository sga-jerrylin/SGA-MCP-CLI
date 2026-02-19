import type { McpClawCore, PackageBuildResult } from '@sga/core';

export type CoreCodegenResult = PackageBuildResult & {
  files: Array<{ path: string; content: string }>;
};

export class CoreCodegenAdapter {
  public constructor(private readonly core: Pick<McpClawCore, 'generate'>) {}

  public async run(planDoc: string): Promise<CoreCodegenResult> {
    const artifact = await this.core.generate({ kind: 'markdown', content: planDoc });
    const maybeFiles = (artifact as unknown as { files?: Array<{ path: string; content: string }> }).files;

    return {
      ...artifact,
      files: maybeFiles ?? []
    };
  }
}
