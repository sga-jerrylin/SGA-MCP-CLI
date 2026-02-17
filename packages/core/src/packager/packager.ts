import type { GeneratedFile } from '../codegen/codegen.service';
import type { IR } from '../ir/ir';
import type { SandboxRunResult } from '../sandbox/sandbox-port';

export interface PackageBuildInput {
  ir: IR;
  files: GeneratedFile[];
  testResult: SandboxRunResult;
}

export interface PackageBuildResult {
  archivePath: string;
  manifestPath: string;
  sbomPath: string;
  signaturePath: string;
}

export interface PackagerPort {
  build(input: PackageBuildInput): Promise<PackageBuildResult>;
}

export class InMemoryPackager implements PackagerPort {
  public async build(input: PackageBuildInput): Promise<PackageBuildResult> {
    const id = input.ir.system.code || 'package';
    return {
      archivePath: `/tmp/${id}.tgz`,
      manifestPath: `/tmp/${id}-manifest.json`,
      sbomPath: `/tmp/${id}-sbom.json`,
      signaturePath: `/tmp/${id}-signature.sig`
    };
  }
}
