import type { Package, PaginatedList } from '@mcp-claw/shared';
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
    listPackages: jest.Mock<PaginatedList<Package>, [number, number]>;
    getPackage: jest.Mock<Package, [string]>;
    installPackage: jest.Mock<Promise<{ downloadUrl: string }>, [string]>;
  };
  let controller: RepoController;

  beforeEach(() => {
    service = {
      listPackages: jest.fn().mockReturnValue(sampleList),
      getPackage: jest.fn().mockReturnValue(samplePackage),
      installPackage: jest.fn().mockResolvedValue({ downloadUrl: 'https://example.test/pkg' })
    };

    controller = new RepoController(service as unknown as RepoService);
  });

  it('returns paginated package list', () => {
    const response = controller.listPackages('2', '10');

    expect(service.listPackages).toHaveBeenCalledWith(2, 10);
    expect(response).toEqual({
      code: 0,
      message: 'ok',
      data: sampleList
    });
  });

  it('returns package detail', () => {
    const response = controller.getPackage('pkg-1');

    expect(service.getPackage).toHaveBeenCalledWith('pkg-1');
    expect(response.data.id).toBe('pkg-1');
  });

  it('returns install download URL', async () => {
    const response = await controller.installPackage('pkg-1');

    expect(service.installPackage).toHaveBeenCalledWith('pkg-1');
    expect(response).toEqual({
      code: 0,
      message: 'ok',
      data: { downloadUrl: 'https://example.test/pkg' }
    });
  });
});
