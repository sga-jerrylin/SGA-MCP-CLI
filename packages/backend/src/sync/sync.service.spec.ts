import { Readable } from 'node:stream';
import type { Package } from '@sga/shared';
import type { MinioService } from '../storage/minio.service';
import { SyncService } from './sync.service';

describe('SyncService', () => {
  const manifest: Package = {
    id: 'pkg-1',
    name: 'Demo',
    version: '1.0.0',
    category: 'demo',
    toolCount: 2,
    serverCount: 1,
    sha256: 'a'.repeat(64),
    signed: true,
    downloads: 0,
    publishedAt: '2026-02-01T00:00:00.000Z'
  };

  it('push stores tarball and manifest', async () => {
    const minio = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn()
    } as unknown as MinioService;
    const service = new SyncService(minio);

    const response = await service.push({
      tarball: Buffer.from('tar-data'),
      metadata: {
        packageId: 'pkg-1',
        manifest,
        autoDeploy: true
      }
    });

    expect((minio as unknown as { putObject: jest.Mock }).putObject).toHaveBeenCalledTimes(2);
    expect(response.packageId).toBe('pkg-1');
    expect(response.deployed).toBe(true);
  });

  it('pull returns tarball and manifest', async () => {
    const minio = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockResolvedValue(Readable.from([Buffer.from('tar-data')]))
    } as unknown as MinioService;
    const service = new SyncService(minio);

    await service.push({
      tarball: Buffer.from('tar-data'),
      metadata: {
        packageId: 'pkg-1',
        manifest
      }
    });

    const pulled = await service.pull('pkg-1');

    expect((minio as unknown as { getObject: jest.Mock }).getObject).toHaveBeenCalledTimes(1);
    expect(pulled.tarball.toString('utf8')).toBe('tar-data');
    expect(pulled.manifest.id).toBe('pkg-1');
  });
});
