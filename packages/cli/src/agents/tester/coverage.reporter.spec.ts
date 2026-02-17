import { extractCoverage } from './coverage.reporter';

describe('extractCoverage', () => {
  it('parses coverage summary lines', () => {
    const result = extractCoverage(
      'Lines : 87.5%\nStatements : 90%\nFunctions : 80%\nBranches : 70%'
    );
    expect(result.lines).toBe(87.5);
    expect(result.statements).toBe(90);
    expect(result.functions).toBe(80);
    expect(result.branches).toBe(70);
  });
});
