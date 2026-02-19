import type { Package } from '@sga/shared';
import { PassThrough } from 'stream';
import { MinioService } from '../storage/minio.service';
import { RuntimeService } from './runtime.service';

describe('RuntimeService', () => {
  const pkg: Package = {
    id: 'pkg-crm',
    name: 'CRM Package',
    version: '1.0.0',
    category: 'crm',
    toolCount: 2,
    serverCount: 1,
    sha256: 'sha256',
    signed: true,
    downloads: 0,
    publishedAt: '2026-02-19T00:00:00.000Z'
  };

  const sidecar = {
    packageId: pkg.id,
    manifest: pkg,
    pushedAt: '2026-02-19T00:10:00.000Z'
  };

  function toStream(content: string): NodeJS.ReadableStream {
    const stream = new PassThrough();
    stream.end(Buffer.from(content, 'utf8'));
    return stream;
  }

  function listStream(keys: string[]): NodeJS.ReadableStream {
    const stream = new PassThrough({ objectMode: true });
    for (const key of keys) {
      stream.write({ name: key });
    }
    stream.end();
    return stream;
  }

  it('lists servers from manifest sidecars', async () => {
    const minio = {
      getClient: jest.fn().mockReturnValue({
        listObjectsV2: jest.fn().mockReturnValue(listStream(['packages/pkg-crm/manifest.json']))
      }),
      getObject: jest.fn().mockResolvedValue(toStream(JSON.stringify(sidecar)))
    } as unknown as MinioService;
    const service = new RuntimeService(minio);

    const servers = await service.listServers();

    expect(servers).toHaveLength(1);
    expect(servers[0]?.id).toBe('pkg-crm');
    expect(servers[0]?.status).toBe('pending');
    expect(servers[0]).not.toHaveProperty('tools');
  });

  it('gets server details by id from manifest sidecar', async () => {
    const minio = {
      getClient: jest.fn().mockReturnValue({
        listObjectsV2: jest.fn().mockReturnValue(listStream([]))
      }),
      getObject: jest.fn().mockResolvedValue(toStream(JSON.stringify(sidecar)))
    } as unknown as MinioService;
    const service = new RuntimeService(minio);

    const detail = await service.getServer('pkg-crm');

    expect(detail.id).toBe('pkg-crm');
    expect(detail.tools).toHaveLength(2);
    expect(detail.metrics.qps).toBe(0);
  });

  it('lists tools for specific server', async () => {
    const minio = {
      getClient: jest.fn().mockReturnValue({
        listObjectsV2: jest.fn().mockReturnValue(listStream([]))
      }),
      getObject: jest.fn().mockResolvedValue(toStream(JSON.stringify(sidecar)))
    } as unknown as MinioService;
    const service = new RuntimeService(minio);

    const result = await service.listTools('pkg-crm');

    expect(result.tools).toHaveLength(2);
    expect(result.tokenBudget).toBe(8000);
  });
});
