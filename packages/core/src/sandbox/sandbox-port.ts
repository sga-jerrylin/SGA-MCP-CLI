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

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
