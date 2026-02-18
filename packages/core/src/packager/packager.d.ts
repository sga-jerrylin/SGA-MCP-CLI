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
export declare class InMemoryPackager implements PackagerPort {
    build(input: PackageBuildInput): Promise<PackageBuildResult>;
}
