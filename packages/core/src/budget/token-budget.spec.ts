import { checkTokenBudget } from './token-budget';

describe('checkTokenBudget', () => {
  it('flags payloads over threshold', () => {
    const payload = 'x'.repeat(40001);
    const result = checkTokenBudget(payload, 8000);

    expect(result.estimated).toBeGreaterThan(8000);
    expect(result.overBudget).toBe(true);
  });

  it('does not flag payloads under threshold', () => {
    const payload = 'x'.repeat(1200);
    const result = checkTokenBudget(payload, 8000);

    expect(result.overBudget).toBe(false);
  });
});
