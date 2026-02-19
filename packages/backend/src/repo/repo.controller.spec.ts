import type { Package, PaginatedList } from '@sga/shared';
import { RepoController } from './repo.controller';
import { RepoService } from './repo.service';

describe('RepoController', () => {
  const samplePackage: Package = {
    id: 'pkg-1',
    name: 'Sample',
    version: '1.0.0',
    category: 'demo',
    toolCount: 2,
    serverCount: 1,
    sha256: 'a'.repeat(64),
    signed: true,
    downloads: 1,
    publishedAt: '2026-02-01T00:00:00.000Z'
  };

  const sampleList: PaginatedList<Package> = {
    items: [samplePackage],
    total: 1,
    page: 1,
    pageSize: 20
  };

  let service: {
    listPackages: jest.Mock<Promise<PaginatedList<Package>>, [number, number]>;
    getPackage: jest.Mock<Promise<Package>, [string]>;
    installPackage: jest.Mock<
      Promise<{ packageId: string; pullUrl: string; manifest: Package }>,
      [string]
    >;
  };
  let controller: RepoController;

  beforeEach(() => {
    service = {
      listPackages: jest.fn().mockResolvedValue(sampleList),
      getPackage: jest.fn().mockResolvedValue(samplePackage),
      installPackage: jest.fn().mockResolvedValue({
        packageId: 'pkg-1',
        pullUrl: '/api/sync/pull/pkg-1',
        manifest: samplePackage
      })
    };

    controller = new RepoController(service as unknown as RepoService);
  });

  it('returns paginated package list', async () => {
    const response = await controller.listPackages('2', '10');

    expect(service.listPackages).toHaveBeenCalledWith(2, 10);
    expect(response).toEqual({
      code: 0,
      message: 'ok',
      data: sampleList
    });
  });

  it('returns package detail', async () => {
    const response = await controller.getPackage('pkg-1');

    expect(service.getPackage).toHaveBeenCalledWith('pkg-1');
    expect(response.data.id).toBe('pkg-1');
  });

  it('returns install download URL', async () => {
    const response = await controller.installPackage('pkg-1');

    expect(service.installPackage).toHaveBeenCalledWith('pkg-1');
    expect(response).toEqual({
      code: 0,
      message: 'ok',
      data: {
        packageId: 'pkg-1',
        pullUrl: '/api/sync/pull/pkg-1',
        manifest: samplePackage
      }
    });
  });
});
