import { runAutofixLoop } from './autofix.controller';

describe('runAutofixLoop', () => {
  it('stops once runOnce returns true', async () => {
    const runOnce = jest
      .fn<Promise<boolean>, []>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await runAutofixLoop(runOnce, 3);

    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(true);
    expect(result.round).toBe(2);
  });

  it('returns needsHuman when all retries fail', async () => {
    const runOnce = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
    const result = await runAutofixLoop(runOnce, 3);

    expect(result.passed).toBe(false);
    expect(result.needsHuman).toBe(true);
    expect(result.round).toBe(3);
  });
});
