import type { PaginatedList } from '@mcp-claw/shared';
import { MonitorController } from './monitor.controller';
import { AuditLog, MonitorService, SystemMetricsSnapshot } from './monitor.service';

describe('MonitorController', () => {
  let service: {
    getMetrics: jest.Mock<SystemMetricsSnapshot, []>;
    getAuditLogs: jest.Mock<PaginatedList<AuditLog>, [number, number]>;
  };
  let controller: MonitorController;

  beforeEach(() => {
    service = {
      getMetrics: jest.fn().mockReturnValue({
        uptime: 100,
        memUsed: 1000,
        activeRequests: 0,
        totalPackages: 2,
        totalServers: 13
      }),
      getAuditLogs: jest.fn().mockReturnValue({
        items: [
          {
            id: 'audit-1',
            action: 'sync.push',
            userId: 'u_admin',
            resource: 'pkg-1',
            createdAt: '2026-02-17T08:00:00.000Z'
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20
      })
    };

    controller = new MonitorController(service as unknown as MonitorService);
  });

  it('returns wrapped metrics', () => {
    const response = controller.getMetrics();
    expect(service.getMetrics).toHaveBeenCalledTimes(1);
    expect(response.code).toBe(0);
    expect(response.data.totalServers).toBe(13);
  });

  it('returns wrapped paginated audit logs', () => {
    const response = controller.getAuditLogs('1', '20');
    expect(service.getAuditLogs).toHaveBeenCalledWith(1, 20);
    expect(response.code).toBe(0);
    expect(response.data.items).toHaveLength(1);
  });
});
