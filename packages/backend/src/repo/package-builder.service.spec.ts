import type { Artifact } from '@sga/shared';
import { PackageBuilderService } from './package-builder.service';

describe('PackageBuilderService', () => {
  it('builds tarball buffer and manifest from artifacts', async () => {
    const service = new PackageBuilderService();
    const artifacts: Artifact[] = [
      {
        id: 'a-1',
        runId: 'r-1',
        type: 'connector',
        fileName: 'connector.ts',
        size: 100,
        createdAt: '2026-02-01T00:00:00.000Z'
      },
      {
        id: 'a-2',
        runId: 'r-1',
        type: 'test',
        fileName: 'connector.spec.ts',
        size: 80,
        createdAt: '2026-02-01T00:01:00.000Z'
      }
    ];

    const result = await service.buildPackage(artifacts);

    expect(Buffer.isBuffer(result.tarball)).toBe(true);
    expect(result.tarball.length).toBeGreaterThan(0);
    expect(result.manifest.toolCount).toBe(2);
    expect(result.manifest.sha256).toHaveLength(64);
  });
});
