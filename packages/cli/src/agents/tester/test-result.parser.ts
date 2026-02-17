export interface ParsedTestResult {
  passed: number;
  failed: number;
  total: number;
}

function readNumber(output: string, key: 'passed' | 'failed' | 'total'): number {
  const match = output.match(new RegExp(`(\\d+)\\s+${key}`, 'i'));
  return Number(match?.[1] ?? 0);
}

export function parseTestResult(output: string): ParsedTestResult {
  return {
    passed: readNumber(output, 'passed'),
    failed: readNumber(output, 'failed'),
    total: readNumber(output, 'total')
  };
}
