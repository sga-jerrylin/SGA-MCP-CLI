import type { GeneratedFile } from '../codegen/codegen.service';
import type { IR } from '../ir/ir';
import type { PackagerPort, PackageBuildResult } from '../packager/packager';
import type { SandboxPort } from '../sandbox/sandbox-port';

export interface McpClawCoreDeps {
  parse(input: { kind: 'markdown' | 'openapi'; content: string }): Promise<IR>;
  codegen(ir: IR): Promise<GeneratedFile[]>;
  sandbox: SandboxPort;
  packager: PackagerPort;
}

export class McpClawCore {
  public constructor(private readonly deps: McpClawCoreDeps) {}

  public async generate(input: {
    kind: 'markdown' | 'openapi';
    content: string;
  }): Promise<PackageBuildResult> {
    const ir = await this.deps.parse(input);
    const files = await this.deps.codegen(ir);
    const testResult = await this.deps.sandbox.runTests({
      files,
      timeoutMs: 30 * 60 * 1000
    });

    return this.deps.packager.build({ ir, files, testResult });
  }
}
