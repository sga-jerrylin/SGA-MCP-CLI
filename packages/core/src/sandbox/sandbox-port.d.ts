import type { GeneratedFile } from '../codegen/codegen.service';
export interface SandboxRunRequest {
    files: GeneratedFile[];
    timeoutMs: number;
}
export interface SandboxRunResult {
    passed: boolean;
    logs: string[];
    failedTests: string[];
}
export interface SandboxPort {
    runTests(req: SandboxRunRequest): Promise<SandboxRunResult>;
}
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T>;
