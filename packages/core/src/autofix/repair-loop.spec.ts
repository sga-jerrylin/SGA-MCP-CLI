import type { GeneratedFile } from '../codegen/codegen.service';

import { runRepairLoop } from './repair-loop';

describe('runRepairLoop', () => {
  it('stops after successful test run', async () => {
    const files: GeneratedFile[] = [{ path: 'client.ts', content: 'v1' }];

    const sandbox = {
      runTests: jest
        .fn()
        .mockResolvedValueOnce({ passed: false, logs: ['fail'], failedTests: ['x'] })
        .mockResolvedValueOnce({ passed: true, logs: ['pass'], failedTests: [] })
    };

    const fixer = {
      apply: jest.fn().mockResolvedValue([{ path: 'client.ts', content: 'v2' }])
    };

    const result = await runRepairLoop({
      initialFiles: files,
      sandbox,
      fixer,
      maxRounds: 3,
      timeoutMs: 1000
    });

    expect(result.passed).toBe(true);
    expect(result.round).toBe(2);
    expect(fixer.apply).toHaveBeenCalledTimes(1);
  });

  it('returns needsHuman after max rounds', async () => {
    const sandbox = {
      runTests: jest.fn().mockResolvedValue({ passed: false, logs: ['fail'], failedTests: ['x'] })
    };

    const fixer = {
      apply: jest.fn().mockResolvedValue([])
    };

    const result = await runRepairLoop({
      initialFiles: [],
      sandbox,
      fixer,
      maxRounds: 3,
      timeoutMs: 1000
    });

    expect(result.passed).toBe(false);
    expect(result.needsHuman).toBe(true);
    expect(result.round).toBe(3);
  });
});
