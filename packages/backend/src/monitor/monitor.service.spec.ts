import type { McpServer } from '@sga/shared';
import { RuntimeService } from '../runtime/runtime.service';
import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  const runtimeServer: McpServer = {
    id: 'pkg-crm',
    name: 'CRM Package',
    shardIndex: 1,
    status: 'healthy',
    toolCount: 2,
    tokenUsage: 240,
    tokenBudget: 8000,
    endpoint: 'http://localhost:8081',
    port: 8081,
    createdAt: '2026-02-19T00:10:00.000Z'
  };

  function createService(serverCount = 1): MonitorService {
    const runtime = {
      listServers: jest
        .fn()
        .mockResolvedValue(Array.from({ length: serverCount }, () => runtimeServer))
    } as unknown as RuntimeService;
    return new MonitorService(runtime);
  }

  it('returns runtime metrics', async () => {
    const service = createService(1);
    const metrics = await service.getMetrics();

    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    expect(metrics.memUsed).toBeGreaterThan(0);
    expect(metrics.totalServers).toBe(1);
    expect(metrics.totalPackages).toBe(1);
  });

  it('returns paginated audit logs', () => {
    const service = createService();
    const result = service.getAuditLogs(1, 1);

    expect(result.items).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });

  it('creates and lists CLI runs', () => {
    const service = createService();
    const runId = service.createRun('E:/mcp');
    const runs = service.getRuns();

    expect(runId).toMatch(/^run_/);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.root).toBe('E:/mcp');
    expect(runs[0]?.events).toHaveLength(0);
  });

  it('appends events and updates run status', () => {
    const service = createService();
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
    const service = createService();
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
