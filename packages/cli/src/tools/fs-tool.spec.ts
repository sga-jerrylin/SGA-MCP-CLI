import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { FsTool } from './fs-tool';

describe('FsTool', () => {
  it('supports write/read/glob for api-related files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mcp-claw-fs-'));
    const tool = new FsTool();

    await tool.writeFile(join(root, 'notes.md'), '# notes');
    writeFileSync(join(root, 'openapi-crm.json'), '{}', 'utf8');
    writeFileSync(join(root, 'docker-compose.yml'), 'services:{}', 'utf8');

    const content = await tool.readFile(join(root, 'notes.md'));
    const matches = await tool.glob(root, ['*.md', 'openapi*.json', 'docker-compose*.yml']);

    expect(content).toContain('notes');
    expect(matches.some((item) => item.endsWith('notes.md'))).toBe(true);
    expect(matches.some((item) => item.endsWith('openapi-crm.json'))).toBe(true);

    await rm(root, { recursive: true, force: true });
  });
});
