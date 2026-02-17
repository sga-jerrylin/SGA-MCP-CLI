import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseToolHeader } from './markdown-parser';

describe('parseToolHeader', () => {
  it('extracts a tool definition from markdown section', () => {
    const fixturePath = join(__dirname, 'fixtures', 'tool-section.md');
    const section = readFileSync(fixturePath, 'utf8');

    const tool = parseToolHeader(section);

    expect(tool).toMatchObject({
      name: 'create_order',
      description: 'Create ERP order',
      method: 'POST',
      path: '/orders',
      needsConfirmation: true,
      isAsync: true
    });
  });
});
