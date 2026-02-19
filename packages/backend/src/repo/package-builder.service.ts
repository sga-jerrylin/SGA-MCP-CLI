import { createHash } from 'node:crypto';
import type { Artifact, Package } from '@sga/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PackageBuilderService {
  public async buildPackage(
    artifacts: Artifact[]
  ): Promise<{ tarball: Buffer; manifest: Package }> {
    const body = artifacts.map((artifact) => `${artifact.fileName}:${artifact.size}`).join('\n');
    const tarball = Buffer.from(body, 'utf8');
    const sha256 = createHash('sha256').update(tarball).digest('hex');
    const now = new Date().toISOString();
    const packageId = `pkg-${Date.now()}`;

    const manifest: Package = {
      id: packageId,
      name: `Package ${packageId}`,
      version: '1.0.0',
      category: 'generated',
      description: 'Generated from MCP artifacts',
      toolCount: artifacts.length,
      serverCount: Math.max(1, Math.ceil(artifacts.length / 40)),
      sha256,
      signed: false,
      downloads: 0,
      publishedAt: now
    };

    return { tarball, manifest };
  }
}
