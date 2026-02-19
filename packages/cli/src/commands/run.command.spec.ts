import { resolve } from 'node:path';

// PipelineProgress uses chalk@5 + ora (ESM-only) — mock for Jest (CJS environment)
jest.mock('../utils/pipeline-progress', () => ({
  PipelineProgress: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    done: jest.fn(),
    fail: jest.fn()
  }))
}));

import { runCommand } from './run.command';

describe('runCommand', () => {
  it('runs Explorer -> Architect -> Builder -> Tester pipeline', async () => {
    const logs: string[] = [];

    await runCommand({
      root: resolve(__dirname, '..', 'fixtures', 'sample-api'),
      logger: {
        log: (message: string) => logs.push(message)
      },
      dryRun: true
    });

    expect(logs.some((message) => message.includes('Explorer'))).toBe(true);
    expect(logs.some((message) => message.includes('Architect'))).toBe(true);
    expect(logs.some((message) => message.includes('Builder'))).toBe(true);
    expect(logs.some((message) => message.includes('Tester'))).toBe(true);
  });
});
