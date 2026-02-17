import type { Package, SyncPushResponse } from '@mcp-claw/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MinioService } from '../storage/minio.service';

export interface SyncPushPayload {
  packageId: string;
  tarball: string;
  manifest: Package;
  autoDeploy?: boolean;
}

@Injectable()
export class SyncService {
  private readonly manifests = new Map<string, Package>();

  public constructor(private readonly minio: MinioService) {}

  public async push(payload: SyncPushPayload): Promise<SyncPushResponse> {
    const tarball = Buffer.from(payload.tarball, 'base64');
    const objectKey = `packages/${payload.packageId}/package.tgz`;

    await this.minio.putObject('packages', objectKey, tarball);
    this.manifests.set(payload.packageId, payload.manifest);

    return {
      packageId: payload.packageId,
      servers: [
        {
          serverId: 'srv-default',
          name: 'Default Server',
          toolCount: payload.manifest.toolCount
        }
      ],
      deployed: Boolean(payload.autoDeploy)
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
