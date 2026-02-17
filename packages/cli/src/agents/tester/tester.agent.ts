import { extractCoverage } from './coverage.reporter';
import { parseTestResult, type ParsedTestResult } from './test-result.parser';
import type { TestRunner } from './test-runner';
import type { TesterSandboxAdapter } from './sandbox.adapter';

export interface TesterInput {
  root: string;
  files: Array<{ path: string; content: string }>;
}

export interface TesterResult {
  passed: boolean;
  summary: ParsedTestResult;
  coverage: ReturnType<typeof extractCoverage>;
  logs: string[];
  failedTests: string[];
}

export interface TesterDeps {
  sandboxAdapter: Pick<TesterSandboxAdapter, 'execute'>;
  runner: Pick<TestRunner, 'run'>;
}

export class TesterAgent {
  public constructor(private readonly deps: TesterDeps) {}

  public async run(input: TesterInput): Promise<TesterResult> {
    const sandbox = await this.deps.sandboxAdapter.execute(input.files);
    const output = await this.deps.runner.run(input.root, 'jest');

    return {
      passed: sandbox.passed,
      summary: parseTestResult(output.stdout),
      coverage: extractCoverage(output.stdout),
      logs: sandbox.logs,
      failedTests: sandbox.failedTests
    };
  }
}
