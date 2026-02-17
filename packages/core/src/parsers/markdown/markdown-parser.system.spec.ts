import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSystemInfo } from './markdown-parser';

describe('parseSystemInfo', () => {
  it('extracts system code, base url and auth type', () => {
    const fixturePath = join(__dirname, 'fixtures', 'system-info.md');
    const markdown = readFileSync(fixturePath, 'utf8');

    const parsed = parseSystemInfo(markdown);

    expect(parsed).toEqual({
      code: 'erp-suite',
      baseUrl: 'https://erp.example.com',
      authType: 'bearer'
    });
  });
});
