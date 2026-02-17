import type { IR } from '../ir/ir';

import { McpClawCore } from './mcp-claw-core';

describe('McpClawCore', () => {
  it('runs parse -> codegen -> sandbox -> package', async () => {
    const ir: IR = {
      system: { code: 'crm', baseUrl: 'https://crm.example.com', authType: 'none' },
      tools: []
    };

    const parse = jest.fn().mockResolvedValue(ir);
    const codegen = jest.fn().mockResolvedValue([{ path: 'client.ts', content: 'x' }]);
    const sandbox = {
      runTests: jest.fn().mockResolvedValue({ passed: true, logs: [], failedTests: [] })
    };
    const packager = {
      build: jest.fn().mockResolvedValue({
        archivePath: '/tmp/archive.tgz',
        manifestPath: '/tmp/manifest.json',
        sbomPath: '/tmp/sbom.json',
        signaturePath: '/tmp/signature.sig'
      })
    };

    const core = new McpClawCore({ parse, codegen, sandbox, packager });
    const result = await core.generate({ kind: 'markdown', content: '# API' });

    expect(parse).toHaveBeenCalledTimes(1);
    expect(codegen).toHaveBeenCalledWith(ir);
    expect(sandbox.runTests).toHaveBeenCalledTimes(1);
    expect(packager.build).toHaveBeenCalledTimes(1);
    expect(result.manifestPath).toBe('/tmp/manifest.json');
  });
});
