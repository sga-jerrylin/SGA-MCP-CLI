import type { Package, SyncPushResponse } from '@sga/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { invalidateRepoCatalog } from '../repo/repo.service';
import { MinioService } from '../storage/minio.service';

export interface SyncPushMetadata {
  packageId: string;
  manifest: Package;
  autoDeploy?: boolean;
}

export interface SyncPushInput {
  tarball: Buffer;
  metadata: SyncPushMetadata;
}

@Injectable()
export class SyncService {
  private readonly manifests = new Map<string, Package>();

  public constructor(private readonly minio: MinioService) {}

  public async push(input: SyncPushInput): Promise<SyncPushResponse> {
    const { metadata, tarball } = input;
    const tarballKey = `packages/${metadata.packageId}/package.tgz`;
    const manifestKey = `packages/${metadata.packageId}/manifest.json`;
    const sidecar = Buffer.from(
      JSON.stringify(
        {
          packageId: metadata.packageId,
          manifest: metadata.manifest,
          pushedAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    await this.minio.putObject('packages', tarballKey, tarball);
    await this.minio.putObject('packages', manifestKey, sidecar);
    this.manifests.set(metadata.packageId, metadata.manifest);
    invalidateRepoCatalog();

    return {
      packageId: metadata.packageId,
      servers: [
        {
          serverId: 'srv-default',
          name: 'Default Server',
          toolCount: metadata.manifest.toolCount
        }
      ],
      deployed: Boolean(metadata.autoDeploy)
    };
  }

  public async pull(packageId: string): Promise<{ tarball: Buffer; manifest: Package }> {
    const tarballKey = `packages/${packageId}/package.tgz`;
    const stream = await this.minio.getObject('packages', tarballKey);
    const tarball = await this.readStream(stream);
    const manifest = await this.loadManifest(packageId);

    return { tarball, manifest };
  }

  private async loadManifest(packageId: string): Promise<Package> {
    const cached = this.manifests.get(packageId);
    if (cached) {
      return cached;
    }

    const manifestKey = `packages/${packageId}/manifest.json`;
    const stream = await this.minio.getObject('packages', manifestKey).catch(() => null);
    if (!stream) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    const buffer = await this.readStream(stream);
    const parsed = JSON.parse(buffer.toString('utf8')) as {
      packageId?: string;
      manifest?: Package;
    };
    if (!parsed.manifest) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    this.manifests.set(packageId, parsed.manifest);
    return parsed.manifest;
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
