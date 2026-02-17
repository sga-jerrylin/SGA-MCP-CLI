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

export async function runRepairLoop(input: RepairLoopInput): Promise<RepairLoopResult> {
  const maxRounds = input.maxRounds ?? 3;
  let files = [...input.initialFiles];
  let lastResult: SandboxRunResult = { passed: false, logs: [], failedTests: [] };

  for (let round = 1; round <= maxRounds; round += 1) {
    lastResult = await input.sandbox.runTests({ files, timeoutMs: input.timeoutMs });
    if (lastResult.passed) {
      return {
        passed: true,
        round,
        lastResult,
        files
      };
    }

    if (round < maxRounds) {
      files = await input.fixer.apply(lastResult.failedTests, files, lastResult.logs);
    }
  }

  return {
    passed: false,
    round: maxRounds,
    needsHuman: true,
    lastResult,
    files
  };
}
