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
      rawDocs: undefined,
      logger,
      dryRun: undefined
    });
  });

  it('derives project name from URL', async () => {
    const logger = { log: jest.fn() };
    const source = 'https://example.com/docs';

    await generateCommand({ source, logger, dryRun: true });

    expect(runCommandMock).toHaveBeenCalledWith({
      root: resolve(process.cwd(), 'mcp-server-example-com-docs'),
      urls: [source],
      rawDocs: undefined,
      logger,
      dryRun: true
    });
  });

  it('derives project name from filename for file source', async () => {
    const logger = { log: jest.fn() };
    // Use this spec file itself as a real file to test file-source path
    const source = __filename;

    const result = await generateCommand({ source, logger, dryRun: true });

    const call = runCommandMock.mock.calls[0]?.[0];
    // Root should be mcp-server-<derived-name> in the same directory as the file
    expect(call?.root).toContain('mcp-server-');
    expect(call?.rawDocs).toHaveLength(1);
    expect(result.root).toBe(call?.root);
  });

  it('returns the root directory', async () => {
    const logger = { log: jest.fn() };
    const source = resolve(__dirname, '..', 'fixtures', 'sample-api');

    const result = await generateCommand({ source, logger });

    expect(result.root).toBe(source);
  });
});
