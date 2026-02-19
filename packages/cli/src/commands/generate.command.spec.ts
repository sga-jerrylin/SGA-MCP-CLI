import { resolve } from 'node:path';

import { generateCommand, isUrl } from './generate.command';
import { runCommand } from './run.command';

jest.mock('./run.command', () => ({
  runCommand: jest.fn().mockResolvedValue(undefined)
}));

describe('isUrl', () => {
  it('identifies http and https URLs', () => {
    expect(isUrl('https://example.com')).toBe(true);
    expect(isUrl('http://example.com')).toBe(true);
    expect(isUrl('/tmp/project')).toBe(false);
  });
});

describe('generateCommand', () => {
  const runCommandMock = runCommand as jest.MockedFunction<typeof runCommand>;

  beforeEach(() => {
    runCommandMock.mockClear();
  });

  it('uses local folder as root and passes empty urls', async () => {
    const logger = { log: jest.fn() };
    const source = resolve(__dirname, '..', 'fixtures', 'sample-api');

    await generateCommand({ source, logger });

    expect(runCommandMock).toHaveBeenCalledWith({
      root: source,
      urls: [],
      logger,
      dryRun: undefined
    });
  });

  it('uses generated-mcp output for URL source by default', async () => {
    const logger = { log: jest.fn() };
    const source = 'https://example.com/docs';

    await generateCommand({ source, logger, dryRun: true });

    expect(runCommandMock).toHaveBeenCalledWith({
      root: resolve(process.cwd(), 'generated-mcp'),
      urls: [source],
      logger,
      dryRun: true
    });
  });
});
