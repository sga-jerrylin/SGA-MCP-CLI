import type { MinioService } from '../storage/minio.service';
import { RepoService } from './repo.service';

describe('RepoService', () => {
  it('lists packages with pagination', () => {
    const service = new RepoService({} as MinioService);
    const list = service.listPackages(1, 1);

    expect(list.total).toBeGreaterThanOrEqual(2);
    expect(list.items).toHaveLength(1);
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(1);
  });

  it('gets package by id', () => {
    const service = new RepoService({} as MinioService);
    const pkg = service.getPackage('pkg-crm-core');

    expect(pkg.name).toBe('CRM Core');
  });

  it('returns presigned install URL if minio helper exists', async () => {
    const minio = {
      presignedUrl: jest.fn().mockResolvedValue('https://example.test/download')
    } as unknown as MinioService;
    const service = new RepoService(minio);

    const result = await service.installPackage('pkg-crm-core');

    expect(result.downloadUrl).toBe('https://example.test/download');
    expect((minio as unknown as { presignedUrl: jest.Mock }).presignedUrl).toHaveBeenCalledTimes(1);
  });
});
