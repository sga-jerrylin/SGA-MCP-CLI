import type { Package } from '@sga/shared';
import { SbomService } from './sbom.service';

describe('SbomService', () => {
  it('generates SPDX-lite object', () => {
    const service = new SbomService();
    const pkg: Package = {
      id: 'pkg-1',
      name: 'Demo',
      version: '1.0.0',
      category: 'demo',
      toolCount: 1,
      serverCount: 1,
      sha256: 'a'.repeat(64),
      signed: true,
      downloads: 0,
      publishedAt: '2026-02-01T00:00:00.000Z'
    };

    const sbom = service.generate(pkg);

    expect(sbom.spdxVersion).toBe('SPDX-2.3');
    expect(sbom.name).toBe('Demo@1.0.0');
    expect(sbom.packages).toEqual([{ name: 'Demo', version: '1.0.0' }]);
  });
});
