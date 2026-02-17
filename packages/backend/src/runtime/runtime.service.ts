import type { McpServer, McpServerDetail, ToolsListResponse } from '@mcp-claw/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class RuntimeService {
  private readonly details: McpServerDetail[] = [
    {
      id: 'srv-1',
      name: 'ERP Server',
      shardIndex: 1,
      status: 'healthy',
      toolCount: 24,
      tokenUsage: 4200,
      tokenBudget: 8000,
      endpoint: 'http://localhost:8081',
      port: 8081,
      createdAt: '2026-02-01T00:00:00.000Z',
      tools: [
        {
          name: 'erp.get_invoice',
          description: 'Get invoice detail'
        },
        {
          name: 'erp.create_invoice',
          description: 'Create invoice'
        }
      ],
      metrics: {
        qps: 11,
        p95Latency: 120,
        errorRate: 0.01
      }
    },
    {
      id: 'srv-2',
      name: 'CRM Server',
      shardIndex: 2,
      status: 'degraded',
      toolCount: 18,
      tokenUsage: 3300,
      tokenBudget: 8000,
      endpoint: 'http://localhost:8082',
      port: 8082,
      createdAt: '2026-02-01T00:00:00.000Z',
      tools: [
        {
          name: 'crm.get_customer',
          description: 'Get customer profile'
        }
      ],
      metrics: {
        qps: 8,
        p95Latency: 180,
        errorRate: 0.03
      }
    }
  ];

  public listServers(): McpServer[] {
    return this.details.map(({ tools: _tools, metrics: _metrics, ...server }) => server);
  }

  public getServer(id: string): McpServerDetail {
    const detail = this.details.find((item) => item.id === id);
    if (!detail) {
      throw new NotFoundException(`Server ${id} not found`);
    }
    return detail;
  }

  public listTools(serverId: string): ToolsListResponse {
    const detail = this.getServer(serverId);
    return {
      tools: detail.tools,
      tokenUsage: detail.tokenUsage,
      tokenBudget: detail.tokenBudget
    };
  }
}
