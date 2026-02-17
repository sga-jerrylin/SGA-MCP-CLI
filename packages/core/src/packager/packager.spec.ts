import type { IR } from '../ir/ir';

import { InMemoryPackager } from './packager';

describe('InMemoryPackager', () => {
  it('returns artifact metadata with manifest/sbom/signature paths', async () => {
    const packager = new InMemoryPackager();
    const ir: IR = {
      system: {
        code: 'erp',
        baseUrl: 'https://erp.example.com',
        authType: 'none'
      },
      tools: []
    };

    const result = await packager.build({
      ir,
      files: [{ path: 'client.ts', content: 'x' }],
      testResult: { passed: true, logs: [], failedTests: [] }
    });

    expect(result.archivePath).toContain('erp');
    expect(result.manifestPath).toContain('manifest.json');
    expect(result.sbomPath).toContain('sbom.json');
    expect(result.signaturePath).toContain('signature.sig');
  });
});
