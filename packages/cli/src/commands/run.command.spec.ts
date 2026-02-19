import { resolve } from 'node:path';

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
