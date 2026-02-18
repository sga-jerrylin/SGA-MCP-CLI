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

  it('creates and lists CLI runs', () => {
    const service = new MonitorService();
    const runId = service.createRun('E:/mcp');
    const runs = service.getRuns();

    expect(runId).toMatch(/^run_/);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.root).toBe('E:/mcp');
    expect(runs[0]?.events).toHaveLength(0);
  });

  it('appends events and updates run status', () => {
    const service = new MonitorService();
    const runId = service.createRun('E:/mcp');

    service.appendEvent(runId, {
      type: 'progress',
      percent: 40,
      stage: 'generating'
    });
    service.appendEvent(runId, {
      type: 'done',
      projectId: 'proj-1',
      artifactCount: 2
    });

    const run = service.getRuns().find((entry) => entry.runId === runId);
    expect(run?.status).toBe('done');
    expect(run?.events).toHaveLength(2);
    const summaries = service.getRunSummaries();
    expect(summaries[0]?.eventCount).toBe(2);
  });

  it('returns events and supports live stream for a run', (done) => {
    const service = new MonitorService();
    const runId = service.createRun('E:/mcp');

    service.appendEvent(runId, {
      type: 'log',
      level: 'info',
      message: 'seed',
      timestamp: '2026-02-18T15:00:00.000Z'
    });

    expect(service.getEvents(runId)).toHaveLength(1);

    const stream = service.getEventStream(runId);
    const sub = stream.subscribe((event) => {
      expect(event.type).toBe('progress');
      sub.unsubscribe();
      done();
    });

    service.appendEvent(runId, {
      type: 'progress',
      percent: 80,
      stage: 'testing'
    });
  });
});
