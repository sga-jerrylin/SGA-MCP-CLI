import type { McpServer, McpServerDetail, ToolsListResponse } from '@sga/shared';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';

describe('RuntimeController', () => {
  const server: McpServer = {
    id: 'srv-1',
    name: 'Server 1',
    shardIndex: 1,
    status: 'healthy',
    toolCount: 2,
    tokenUsage: 1000,
    tokenBudget: 8000,
    endpoint: 'http://localhost:8081',
    port: 8081,
    createdAt: '2026-02-01T00:00:00.000Z'
  };

  const detail: McpServerDetail = {
    ...server,
    tools: [{ name: 'tool.one' }],
    metrics: { qps: 1, p95Latency: 50, errorRate: 0 }
  };

  const tools: ToolsListResponse = {
    tools: [{ name: 'tool.one' }],
    tokenUsage: 1000,
    tokenBudget: 8000
  };

  let service: {
    listServers: jest.Mock<Promise<McpServer[]>, []>;
    getServer: jest.Mock<Promise<McpServerDetail>, [string]>;
    listTools: jest.Mock<Promise<ToolsListResponse>, [string]>;
  };
  let controller: RuntimeController;

  beforeEach(() => {
    service = {
      listServers: jest.fn().mockResolvedValue([server]),
      getServer: jest.fn().mockResolvedValue(detail),
      listTools: jest.fn().mockResolvedValue(tools)
    };
    controller = new RuntimeController(service as unknown as RuntimeService);
  });

  it('returns runtime servers', async () => {
    const response = await controller.listServers();

    expect(service.listServers).toHaveBeenCalledTimes(1);
    expect(response.data).toHaveLength(1);
  });

  it('returns runtime server detail', async () => {
    const response = await controller.getServer('srv-1');

    expect(service.getServer).toHaveBeenCalledWith('srv-1');
    expect(response.data.metrics.qps).toBe(1);
  });

  it('returns runtime server tools', async () => {
    const response = await controller.listTools('srv-1');

    expect(service.listTools).toHaveBeenCalledWith('srv-1');
    expect(response.data.tokenBudget).toBe(8000);
  });
});
