import { join } from 'node:path';

import { generateCommand } from '../commands/generate.command';

jest.mock('../utils/pipeline-progress', () => ({
  PipelineProgress: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    done: jest.fn(),
    fail: jest.fn()
  }))
}));

describe('E2E: generate from folder', () => {
  it(
    'runs full pipeline from sample-api fixture',
    async () => {
      const logs: string[] = [];

      await generateCommand({
        source: join(__dirname, '../fixtures/sample-api'),
        logger: { log: (message: string) => logs.push(message) },
        dryRun: true
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((line) => /explorer/i.test(line))).toBe(true);
      expect(logs.some((line) => /architect/i.test(line))).toBe(true);
      expect(logs.some((line) => /builder/i.test(line))).toBe(true);
      expect(logs.some((line) => /tester/i.test(line))).toBe(true);
    },
    15_000
  );
});
