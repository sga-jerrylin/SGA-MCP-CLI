import type { McpServer, McpServerDetail, ToolsListResponse } from '@mcp-claw/shared';
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
    listServers: jest.Mock<McpServer[], []>;
    getServer: jest.Mock<McpServerDetail, [string]>;
    listTools: jest.Mock<ToolsListResponse, [string]>;
  };
  let controller: RuntimeController;

  beforeEach(() => {
    service = {
      listServers: jest.fn().mockReturnValue([server]),
      getServer: jest.fn().mockReturnValue(detail),
      listTools: jest.fn().mockReturnValue(tools)
    };
    controller = new RuntimeController(service as unknown as RuntimeService);
  });

  it('returns runtime servers', () => {
    const response = controller.listServers();

    expect(service.listServers).toHaveBeenCalledTimes(1);
    expect(response.data).toHaveLength(1);
  });

  it('returns runtime server detail', () => {
    const response = controller.getServer('srv-1');

    expect(service.getServer).toHaveBeenCalledWith('srv-1');
    expect(response.data.metrics.qps).toBe(1);
  });

  it('returns runtime server tools', () => {
    const response = controller.listTools('srv-1');

    expect(service.listTools).toHaveBeenCalledWith('srv-1');
    expect(response.data.tokenBudget).toBe(8000);
  });
});
