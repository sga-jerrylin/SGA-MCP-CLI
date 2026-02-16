import { runContractChecks } from './contract-runner.ts';

const result = runContractChecks({
  contractPath: 'E:/mcp/packages/shared/api-contract.yaml',
  requiredPaths: ['/auth/login', '/generator/projects', '/runtime/servers', '/sync/push'],
});

if (result.total < 4) {
  throw new Error('contract checks should cover at least 4 required endpoints');
}
if (result.failed.length > 0) {
  throw new Error(`unexpected failures: ${result.failed.join(', ')}`);
}
