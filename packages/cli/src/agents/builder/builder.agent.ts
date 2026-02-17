import type { CoreCodegenAdapter, CoreCodegenResult } from './core-codegen.adapter';
import type { DependencyInstaller } from './dependency-installer';
import { writeGeneratedFiles } from './file-writer';

export interface BuilderInput {
  root: string;
  planDoc: string;
}

export interface BuilderResult {
  artifact: Omit<CoreCodegenResult, 'files'>;
  writtenFiles: string[];
}

export interface BuilderDeps {
  adapter: Pick<CoreCodegenAdapter, 'run'>;
  writer?: {
    write(root: string, files: Array<{ path: string; content: string }>): Promise<string[]>;
  };
  installer: Pick<DependencyInstaller, 'install'>;
}

export class BuilderAgent {
  public constructor(private readonly deps: BuilderDeps) {}

  public async run(input: BuilderInput): Promise<BuilderResult> {
    const execution = await this.deps.adapter.run(input.planDoc);

    const writer = this.deps.writer ?? {
      write: writeGeneratedFiles
    };

    const writtenFiles = await writer.write(input.root, execution.files);
    await this.deps.installer.install(input.root);

    const { files: _unused, ...artifact } = execution;

    return {
      artifact,
      writtenFiles
    };
  }
}
