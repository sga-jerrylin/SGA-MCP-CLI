import type { Package, PaginatedList } from '@mcp-claw/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MinioService } from '../storage/minio.service';

type MinioWithPresigned = {
  presignedUrl?: (bucket: string, key: string, expirySeconds?: number) => Promise<string> | string;
};

@Injectable()
export class RepoService {
  private readonly packages: Package[] = [
    {
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
    },
    {
      id: 'pkg-erp-finance',
      name: 'ERP Finance',
      version: '1.1.0',
      description: 'Finance module package',
      category: 'erp',
      toolCount: 26,
      serverCount: 1,
      sha256: '1'.repeat(64),
      signed: true,
      downloads: 11,
      publishedAt: new Date('2026-02-02T00:00:00.000Z').toISOString()
    }
  ];

  public constructor(private readonly minio: MinioService) {}

  public listPackages(page = 1, size = 20): PaginatedList<Package> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 20;
    const start = (safePage - 1) * safeSize;
    const items = this.packages.slice(start, start + safeSize);

    return {
      items,
      total: this.packages.length,
      page: safePage,
      pageSize: safeSize
    };
  }

  public getPackage(id: string): Package {
    const pkg = this.packages.find((item) => item.id === id);
    if (!pkg) {
      throw new NotFoundException(`Package ${id} not found`);
    }

    return pkg;
  }

  public async installPackage(id: string): Promise<{ downloadUrl: string }> {
    const pkg = this.getPackage(id);
    const objectKey = `packages/${pkg.id}/${pkg.version}.tar.gz`;

    const minioWithPresigned = this.minio as unknown as MinioWithPresigned;
    if (typeof minioWithPresigned.presignedUrl === 'function') {
      const url = await minioWithPresigned.presignedUrl('packages', objectKey, 900);
      return { downloadUrl: url };
    }

    return {
      downloadUrl: `https://minio.local/packages/${objectKey}`
    };
  }
}
