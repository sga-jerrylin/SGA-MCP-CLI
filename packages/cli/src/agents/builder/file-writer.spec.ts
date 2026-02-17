import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeGeneratedFiles } from './file-writer';

describe('writeGeneratedFiles', () => {
  it('writes generated files to target directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mcp-claw-builder-'));
    const written = await writeGeneratedFiles(root, [
      { path: 'auth.ts', content: 'export const x=1;' },
      { path: 'tools/a.ts', content: 'export const a=1;' }
    ]);

    expect(written).toHaveLength(2);
    expect(written.some((path) => path.endsWith('tools\\a.ts') || path.endsWith('tools/a.ts'))).toBe(true);

    await rm(root, { recursive: true, force: true });
  });
});
