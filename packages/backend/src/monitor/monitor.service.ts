import type { PaginatedList } from '@mcp-claw/shared';
import { Injectable } from '@nestjs/common';

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  resource: string;
  createdAt: string;
}

export interface SystemMetricsSnapshot {
  uptime: number;
  memUsed: number;
  activeRequests: number;
  totalPackages: number;
  totalServers: number;
}

@Injectable()
export class MonitorService {
  private readonly auditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      action: 'sync.push',
      userId: 'u_admin',
      resource: 'pkg-crm-core',
      createdAt: '2026-02-17T08:00:00.000Z'
    },
    {
      id: 'audit-2',
      action: 'deploy.execute',
      userId: 'u_admin',
      resource: 'srv-1',
      createdAt: '2026-02-17T08:05:00.000Z'
    }
  ];

  public getMetrics(): SystemMetricsSnapshot {
    const memoryUsage = process.memoryUsage();

    return {
      uptime: Math.floor(process.uptime()),
      memUsed: memoryUsage.heapUsed,
      activeRequests: 0,
      totalPackages: 2,
      totalServers: 13
    };
  }

  public getAuditLogs(page = 1, pageSize = 20): PaginatedList<AuditLog> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
    const start = (safePage - 1) * safePageSize;

    return {
      items: this.auditLogs.slice(start, start + safePageSize),
      total: this.auditLogs.length,
      page: safePage,
      pageSize: safePageSize
    };
  }
}
