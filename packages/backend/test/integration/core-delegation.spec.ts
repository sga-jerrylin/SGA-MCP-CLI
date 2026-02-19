import { Test } from '@nestjs/testing';
import { McpClawCore } from '@sga/core';

import { GeneratorService } from '../../src/generator/generator.service';

describe('core delegation integration', () => {
  it('delegates generation pipeline to shared core', async () => {
    const core = {
      generate: jest.fn().mockResolvedValue({
        archivePath: '/tmp/archive.tgz',
        manifestPath: '/tmp/manifest.json',
        sbomPath: '/tmp/sbom.json',
        signaturePath: '/tmp/signature.sig'
      })
    };

    const moduleRef = await Test.createTestingModule({
      providers: [GeneratorService, { provide: McpClawCore, useValue: core }]
    }).compile();

    const service = moduleRef.get(GeneratorService);
    const result = await service.generateFromDoc('# API Doc');

    expect(core.generate).toHaveBeenCalledWith({ kind: 'markdown', content: '# API Doc' });
    expect(result).toHaveProperty('manifestPath', '/tmp/manifest.json');
  });
});
