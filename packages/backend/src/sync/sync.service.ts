import type { Package, SyncPushResponse } from '@mcp-claw/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
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
    const objectKey = `packages/${metadata.packageId}/package.tgz`;

    await this.minio.putObject('packages', objectKey, tarball);
    this.manifests.set(metadata.packageId, metadata.manifest);

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
    const manifest = this.manifests.get(packageId);
    if (!manifest) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    const objectKey = `packages/${packageId}/package.tgz`;
    const stream = await this.minio.getObject('packages', objectKey);
    const tarball = await this.readStream(stream);

    return { tarball, manifest };
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
