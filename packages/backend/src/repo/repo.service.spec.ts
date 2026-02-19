import { Readable } from 'node:stream';
import type { Package } from '@sga/shared';
import type { MinioService } from '../storage/minio.service';
import { RepoService, invalidateRepoCatalog } from './repo.service';

function asStream(payload: unknown): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(JSON.stringify(payload))]);
}

describe('RepoService', () => {
  const manifest: Package = {
    id: 'pkg-crm-core',
    name: 'CRM Core',
    version: '1.0.0',
    description: 'Core CRM tool package',
    category: 'crm',
    toolCount: 18,
    serverCount: 1,
    sha256: '0'.repeat(64),
    signed: true,
    downloads: 42,
    publishedAt: new Date('2026-02-01T00:00:00.000Z').toISOString()
  };

  const buildMinioMock = () => {
    const listStream = new Readable({
      objectMode: true,
      read() {
        this.push({ name: 'packages/pkg-crm-core/manifest.json' });
        this.push(null);
      }
    });

    return {
      getClient: jest.fn().mockReturnValue({
        listObjectsV2: jest.fn().mockReturnValue(listStream)
      }),
      getObject: jest
        .fn()
        .mockImplementation((_bucket: string, key: string) =>
          asStream({ packageId: 'pkg-crm-core', manifest, pushedAt: '2026-02-19T00:00:00.000Z' })
        )
    } as unknown as MinioService;
  };

  beforeEach(() => {
    invalidateRepoCatalog();
  });

  it('lists packages from minio catalog with pagination', async () => {
    const minio = buildMinioMock();
    const service = new RepoService(minio);
    const list = await service.listPackages(1, 1);

    expect(list.total).toBe(1);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.id).toBe('pkg-crm-core');
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(1);
  });

  it('gets package by id from minio sidecar', async () => {
    const minio = buildMinioMock();
    const service = new RepoService(minio);
    const pkg = await service.getPackage('pkg-crm-core');

    expect(pkg.name).toBe('CRM Core');
  });

  it('returns install download URL from real package id', async () => {
    const minio = buildMinioMock();
    const service = new RepoService(minio);

    const result = await service.installPackage('pkg-crm-core');

    expect(result.packageId).toBe('pkg-crm-core');
    expect(result.pullUrl).toBe('/api/sync/pull/pkg-crm-core');
    expect(result.manifest.id).toBe('pkg-crm-core');
  });
});
