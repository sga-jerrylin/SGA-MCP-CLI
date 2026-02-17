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
