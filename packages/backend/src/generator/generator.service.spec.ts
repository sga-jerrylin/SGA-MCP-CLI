import type { PackageBuildResult } from '@sga/core';
import { McpClawCore } from '@sga/core';

import { GeneratorService } from './generator.service';

describe('GeneratorService', () => {
  it('delegates generation to McpClawCore.generate once', async () => {
    const artifact: PackageBuildResult = {
      archivePath: '/tmp/pkg.tgz',
      manifestPath: '/tmp/manifest.json',
      sbomPath: '/tmp/sbom.json',
      signaturePath: '/tmp/signature.sig'
    };

    const core = {
      generate: jest.fn().mockResolvedValue(artifact)
    } as unknown as McpClawCore;

    const service = new GeneratorService(core);
    const result = await service.generateFromDoc('# API');

    expect(core.generate as jest.Mock).toHaveBeenCalledTimes(1);
    expect(core.generate as jest.Mock).toHaveBeenCalledWith({ kind: 'markdown', content: '# API' });
    expect(result.manifestPath).toBe('/tmp/manifest.json');
  });
});
