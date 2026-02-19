import type {
  McpServer,
  McpServerDetail,
  McpTool,
  Package,
  ToolsListResponse
} from '@sga/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import type * as Minio from 'minio';
import { MinioService } from '../storage/minio.service';

interface ManifestSidecar {
  packageId: string;
  manifest: Package;
  pushedAt: string;
}

@Injectable()
export class RuntimeService {
  public constructor(private readonly minio: MinioService) {}

  public async listServers(): Promise<McpServer[]> {
    const sidecars = await this.loadAllSidecars();

    return sidecars.map((sidecar, index) =>
      this.toServer(
        sidecar.manifest,
        this.computeShardIndex(sidecar.packageId, index),
        sidecar.pushedAt
      )
    );
  }

  public async getServer(id: string): Promise<McpServerDetail> {
    const sidecar = await this.readManifestSidecarById(id).catch(() => null);
    if (!sidecar) {
      throw new NotFoundException(`Server ${id} not found`);
    }

    const base = this.toServer(sidecar.manifest, this.computeShardIndex(id), sidecar.pushedAt);
    const tools = this.toTools(sidecar.manifest);

    return {
      ...base,
      tools,
      metrics: {
        qps: 0,
        p95Latency: 0,
        errorRate: 0
      }
    };
  }

  public async listTools(serverId: string): Promise<ToolsListResponse> {
    const detail = await this.getServer(serverId);
    return {
      tools: detail.tools,
      tokenUsage: detail.tokenUsage,
      tokenBudget: detail.tokenBudget
    };
  }

  private async loadAllSidecars(): Promise<ManifestSidecar[]> {
    const keys = await this.listManifestKeys();
    const sidecars: ManifestSidecar[] = [];

    for (const key of keys) {
      try {
        const sidecar = await this.readManifestSidecarByKey(key);
        sidecars.push(sidecar);
      } catch {
        // Skip malformed sidecar.
      }
    }

    sidecars.sort((left, right) => right.pushedAt.localeCompare(left.pushedAt));
    return sidecars;
  }

  private async readManifestSidecarById(packageId: string): Promise<ManifestSidecar> {
    return this.readManifestSidecarByKey(`packages/${packageId}/manifest.json`);
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

    return new Promise<string[]>((resolve) => {
      const keys: string[] = [];

      stream.on('data', (item: Minio.BucketItem) => {
        if (typeof item.name === 'string' && item.name.endsWith('/manifest.json')) {
          keys.push(item.name);
        }
      });
      stream.on('error', () => resolve([]));
      stream.on('end', () => resolve(keys));
    });
  }

  private toServer(pkg: Package, shardIndex: number, pushedAt: string): McpServer {
    const port = 8080 + shardIndex;

    return {
      id: pkg.id,
      name: pkg.name,
      shardIndex,
      status: 'pending',
      toolCount: pkg.toolCount,
      tokenUsage: Math.min(pkg.toolCount * 120, 8000),
      tokenBudget: 8000,
      endpoint: `http://localhost:${port}`,
      port,
      createdAt: pushedAt || pkg.publishedAt
    };
  }

  private toTools(pkg: Package): McpTool[] {
    const count = Math.max(0, Math.min(pkg.toolCount, 20));
    const tools: McpTool[] = [];

    for (let index = 0; index < count; index += 1) {
      tools.push({
        name: `${pkg.id}.tool_${index + 1}`,
        description: `Generated tool ${index + 1} for ${pkg.name}`
      });
    }

    return tools;
  }

  private computeShardIndex(packageId: string, fallbackIndex = 0): number {
    let hash = 0;
    for (const char of packageId) {
      hash = (hash * 31 + char.charCodeAt(0)) | 0;
    }
    const normalized = Math.abs(hash || fallbackIndex + 1);
    return (normalized % 13) + 1;
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
