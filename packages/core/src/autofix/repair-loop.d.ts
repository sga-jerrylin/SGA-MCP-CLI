import type { GeneratedFile } from '../codegen/codegen.service';
import type { SandboxPort, SandboxRunResult } from '../sandbox/sandbox-port';
export interface RepairFixer {
    apply(failedTests: string[], files: GeneratedFile[], logs: string[]): Promise<GeneratedFile[]>;
}
export interface RepairLoopInput {
    initialFiles: GeneratedFile[];
    sandbox: SandboxPort;
    fixer: RepairFixer;
    maxRounds?: number;
    timeoutMs: number;
}
export interface RepairLoopResult {
    passed: boolean;
    round: number;
    needsHuman?: boolean;
    lastResult: SandboxRunResult;
    files: GeneratedFile[];
}
export declare function runRepairLoop(input: RepairLoopInput): Promise<RepairLoopResult>;
