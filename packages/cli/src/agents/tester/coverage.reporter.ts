export interface CoverageSummary {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

function readPercent(output: string, key: string): number {
  const match = output.match(new RegExp(`${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)%`, 'i'));
  return Number(match?.[1] ?? 0);
}

export function extractCoverage(output: string): CoverageSummary {
  return {
    lines: readPercent(output, 'Lines'),
    statements: readPercent(output, 'Statements'),
    functions: readPercent(output, 'Functions'),
    branches: readPercent(output, 'Branches')
  };
}
