import type { GeneratedFile } from '../codegen/codegen.service';
import type { IR } from '../ir/ir';
import type { PackagerPort, PackageBuildResult } from '../packager/packager';
import type { SandboxPort } from '../sandbox/sandbox-port';
export interface McpClawCoreDeps {
    parse(input: {
        kind: 'markdown' | 'openapi';
        content: string;
    }): Promise<IR>;
    codegen(ir: IR): Promise<GeneratedFile[]>;
    sandbox: SandboxPort;
    packager: PackagerPort;
}
export declare class McpClawCore {
    private readonly deps;
    constructor(deps: McpClawCoreDeps);
    generate(input: {
        kind: 'markdown' | 'openapi';
        content: string;
    }): Promise<PackageBuildResult>;
}
