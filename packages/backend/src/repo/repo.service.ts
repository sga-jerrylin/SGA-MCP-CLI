import type { Package, PaginatedList } from '@sga/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import type * as Minio from 'minio';
import { MinioService } from '../storage/minio.service';

interface ManifestSidecar {
  packageId: string;
  manifest: Package;
  pushedAt: string;
}

let repoCatalogVersion = 0;

export function invalidateRepoCatalog(): void {
  repoCatalogVersion += 1;
}

@Injectable()
export class RepoService {
  private cachedCatalog: { version: number; items: Package[] } | null = null;

  public constructor(private readonly minio: MinioService) {}

  public async listPackages(page = 1, size = 20): Promise<PaginatedList<Package>> {
    const packages = await this.loadCatalog();
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 20;
    const start = (safePage - 1) * safeSize;
    const items = packages.slice(start, start + safeSize);

    return {
      items,
      total: packages.length,
      page: safePage,
      pageSize: safeSize
    };
  }

  public async getPackage(id: string): Promise<Package> {
    const packages = await this.loadCatalog();
    const pkg = packages.find((item) => item.id === id);
    if (pkg) {
      return pkg;
    }

    const sidecar = await this.loadManifestSidecar(id).catch(() => null);
    if (sidecar) {
      return sidecar.manifest;
    }

    throw new NotFoundException(`Package ${id} not found`);
  }

  public async installPackage(
    id: string
  ): Promise<{ packageId: string; pullUrl: string; manifest: Package }> {
    const manifest = await this.getPackage(id);
    return {
      packageId: id,
      pullUrl: `/api/sync/pull/${id}`,
      manifest
    };
  }

  private async loadCatalog(): Promise<Package[]> {
    if (this.cachedCatalog && this.cachedCatalog.version === repoCatalogVersion) {
      return this.cachedCatalog.items;
    }

    const manifestKeys = await this.listManifestKeys();
    const packageList: Package[] = [];

    for (const key of manifestKeys) {
      try {
        const sidecar = await this.readManifestSidecarByKey(key);
        packageList.push(sidecar.manifest);
      } catch {
        // Skip malformed sidecar and continue loading catalog.
      }
    }

    packageList.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
    this.cachedCatalog = {
      version: repoCatalogVersion,
      items: packageList
    };

    return packageList;
  }

  private async loadManifestSidecar(packageId: string): Promise<ManifestSidecar> {
    const key = `packages/${packageId}/manifest.json`;
    return this.readManifestSidecarByKey(key);
  }

  private async readManifestSidecarByKey(key: string): Promise<ManifestSidecar> {
    const stream = await this.minio.getObject('packages', key);
    const buffer = await this.readStream(stream);
    const parsed = JSON.parse(buffer.toString('utf8')) as Partial<ManifestSidecar>;

    if (
      typeof parsed.packageId !== 'string' ||
      !parsed.manifest ||
      typeof parsed.manifest !== 'object'
    ) {
      throw new Error(`Invalid manifest sidecar: ${key}`);
    }

    return {
      packageId: parsed.packageId,
      manifest: parsed.manifest as Package,
      pushedAt: typeof parsed.pushedAt === 'string' ? parsed.pushedAt : new Date().toISOString()
    };
  }

  private async listManifestKeys(): Promise<string[]> {
    const client = this.minio.getClient();
    const stream = client.listObjectsV2('packages', 'packages/', true);

    return new Promise<string[]>((resolve, reject) => {
      const keys: string[] = [];

      stream.on('data', (item: Minio.BucketItem) => {
        if (typeof item.name === 'string' && item.name.endsWith('/manifest.json')) {
          keys.push(item.name);
        }
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(keys));
    });
  }

  private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: unknown) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
