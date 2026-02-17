import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  it('returns runtime metrics', () => {
    const service = new MonitorService();
    const metrics = service.getMetrics();

    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.memUsed).toBeGreaterThan(0);
    expect(metrics.totalServers).toBe(13);
  });

  it('returns paginated audit logs', () => {
    const service = new MonitorService();
    const result = service.getAuditLogs(1, 1);

    expect(result.items).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });
});
