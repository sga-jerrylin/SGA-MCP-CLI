import type { Package, SyncPushResponse } from '@sga/shared';
import { SyncController } from './sync.controller';
import { SyncService, type SyncPushInput } from './sync.service';

describe('SyncController', () => {
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

  let service: {
    push: jest.Mock<Promise<SyncPushResponse>, [SyncPushInput]>;
    pull: jest.Mock<Promise<{ tarball: Buffer; manifest: Package }>, [string]>;
  };
  let controller: SyncController;

  beforeEach(() => {
    service = {
      push: jest.fn().mockResolvedValue({
        packageId: 'pkg-1',
        servers: [{ serverId: 'srv-1', name: 'S1', toolCount: 2 }],
        deployed: false
      }),
      pull: jest.fn().mockResolvedValue({
        tarball: Buffer.from('tar'),
        manifest
      })
    };

    controller = new SyncController(service as unknown as SyncService);
  });

  it('delegates push to service', async () => {
    const body = {
      metadata: JSON.stringify({
        packageId: 'pkg-1',
        manifest
      })
    };
    const file = {
      buffer: Buffer.from('tar')
    };
    const expected: SyncPushInput = {
      tarball: file.buffer,
      metadata: {
        packageId: 'pkg-1',
        manifest
      }
    };

    const response = await controller.push(body, file);

    expect(service.push).toHaveBeenCalledWith(expected);
    expect(response.code).toBe(0);
    expect(response.data.packageId).toBe('pkg-1');
  });

  it('delegates pull to service', async () => {
    const response = await controller.pull('pkg-1');

    expect(service.pull).toHaveBeenCalledWith('pkg-1');
    expect(response.data.manifest.id).toBe('pkg-1');
  });
});
