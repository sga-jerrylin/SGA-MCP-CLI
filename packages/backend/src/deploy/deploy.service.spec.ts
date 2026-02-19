import type { McpServer, Package } from '@sga/shared';
import { BadRequestException } from '@nestjs/common';
import { RuntimeService } from '../runtime/runtime.service';
import { SyncService } from '../sync/sync.service';
import { DockerService } from './docker.service';
import { DeployService } from './deploy.service';

describe('DeployService', () => {
  const serverA: McpServer = {
    id: 'pkg-a',
    name: 'Package A',
    shardIndex: 1,
    status: 'healthy',
    toolCount: 10,
    tokenUsage: 3000,
    tokenBudget: 8000,
    endpoint: 'http://localhost:8081',
    port: 8081,
    createdAt: '2026-02-01T00:00:00.000Z'
  };
  const serverB: McpServer = {
    ...serverA,
    id: 'pkg-b',
    name: 'Package B',
    tokenUsage: 6000,
    port: 8082
  };

  const manifest: Package = {
    id: 'pkg-a',
    name: 'Package A',
    version: '1.0.0',
    category: 'erp',
    toolCount: 10,
    serverCount: 1,
    sha256: 'sha',
    signed: true,
    downloads: 0,
    publishedAt: '2026-02-01T00:00:00.000Z'
  };

  function createService() {
    const sync = {
      pull: jest.fn().mockResolvedValue({ tarball: Buffer.alloc(0), manifest })
    } as unknown as SyncService;
    const runtime = {
      listServers: jest.fn().mockResolvedValue([serverA, serverB])
    } as unknown as RuntimeService;
    const docker = {
      composeUp: jest.fn().mockResolvedValue(undefined),
      composeDown: jest.fn().mockResolvedValue(undefined),
      inspectContainer: jest.fn().mockResolvedValue('running'),
      isDockerAvailable: jest.fn().mockResolvedValue(true)
    } as unknown as DockerService;

    const service = new DeployService(sync, runtime, docker);
    return { service, sync, runtime, docker };
  }

  it('returns deployment preview payload', async () => {
    const { service } = createService();
    const preview = await service.preview({ serverIds: ['pkg-a'] });

    expect(preview.composeYaml).toContain('services:');
    expect(preview.servers).toHaveLength(1);
    expect(preview.servers[0]?.serverId).toBe('pkg-a');
  });

  it('throws when preview token budget exceeds 8000', async () => {
    const { service } = createService();

    await expect(service.preview({ serverIds: ['pkg-a', 'pkg-b'] })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('creates deploy task in pending status', async () => {
    const { service } = createService();
    const task = await service.execute({ serverIds: ['pkg-a'] });

    expect(task.status).toBe('pending');
    expect(task.serverIds).toEqual(['pkg-a']);
    expect(task.id).toContain('deploy-');
  });

  it('returns created deploy task by id', async () => {
    const { service } = createService();
    const task = await service.execute({ serverIds: ['pkg-a'] });
    const found = service.getTask(task.id);

    expect(found.id).toBe(task.id);
    expect(found.serverIds).toEqual(['pkg-a']);
  });
});
