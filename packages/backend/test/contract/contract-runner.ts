import { readFileSync } from 'node:fs';

export interface ContractRunOptions {
  contractPath: string;
  requiredPaths: string[];
}

export interface ContractRunResult {
  total: number;
  passed: string[];
  failed: string[];
}

export function runContractChecks(options: ContractRunOptions): ContractRunResult {
  const raw = readFileSync(options.contractPath, 'utf8');
  const passed: string[] = [];
  const failed: string[] = [];

  for (const p of options.requiredPaths) {
    if (raw.includes(`  ${p}:`)) {
      passed.push(p);
    } else {
      failed.push(p);
    }
  }

  return {
    total: options.requiredPaths.length,
    passed,
    failed,
  };
}

if (process.argv[1]?.endsWith('contract-runner.ts')) {
  const result = runContractChecks({
    contractPath: 'E:/mcp/packages/shared/api-contract.yaml',
    requiredPaths: [
      '/auth/login',
      '/generator/projects',
      '/runtime/servers',
      '/deploy/preview',
      '/sync/push',
      '/sync/pull/{packageId}',
    ],
  });

  if (result.failed.length > 0) {
    console.error(`Contract check failed: ${result.failed.join(', ')}`);
    process.exit(1);
  }

  console.log(`Contract checks passed (${result.passed.length}/${result.total}).`);
}
