import { parseTestResult } from './test-result.parser';

describe('parseTestResult', () => {
  it('extracts pass/fail counts from test output', () => {
    const parsed = parseTestResult('Tests: 3 passed, 1 failed, 4 total');
    expect(parsed.passed).toBe(3);
    expect(parsed.failed).toBe(1);
    expect(parsed.total).toBe(4);
  });
});
