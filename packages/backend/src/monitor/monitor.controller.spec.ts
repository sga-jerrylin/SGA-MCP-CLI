import type { PaginatedList, SseEvent } from '@sga/shared';
import { of } from 'rxjs';
import { MonitorController } from './monitor.controller';
import {
  AgentRunSummary,
  AuditLog,
  MonitorService,
  SystemMetricsSnapshot
} from './monitor.service';

describe('MonitorController', () => {
  let service: {
    getMetrics: jest.Mock<Promise<SystemMetricsSnapshot>, []>;
    getAuditLogs: jest.Mock<PaginatedList<AuditLog>, [number, number]>;
    createRun: jest.Mock<string, [string]>;
    appendEvent: jest.Mock<void, [string, SseEvent]>;
    getRunSummaries: jest.Mock<AgentRunSummary[], []>;
    getEvents: jest.Mock<SseEvent[], [string]>;
    getEventStream: jest.Mock<{ asObservable: () => ReturnType<typeof of> }, [string]>;
  };
  let controller: MonitorController;

  beforeEach(() => {
    service = {
      getMetrics: jest.fn().mockResolvedValue({
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
      }),
      createRun: jest.fn().mockReturnValue('run-1'),
      appendEvent: jest.fn(),
      getRunSummaries: jest.fn().mockReturnValue([
        {
          runId: 'run-1',
          root: 'E:/mcp',
          status: 'running',
          startedAt: '2026-02-18T14:00:00.000Z',
          eventCount: 1
        }
      ]),
      getEvents: jest.fn().mockReturnValue([
        {
          type: 'log',
          level: 'info',
          message: 'history',
          timestamp: '2026-02-18T14:00:00.000Z'
        }
      ]),
      getEventStream: jest.fn().mockReturnValue({
        asObservable: () =>
          of({
            type: 'progress',
            percent: 40,
            stage: 'generating'
          } satisfies SseEvent)
      })
    };

    controller = new MonitorController(service as unknown as MonitorService);
  });

  it('returns wrapped metrics', async () => {
    const response = await controller.getMetrics();
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

  it('creates a CLI run', () => {
    const response = controller.createCliRun({ root: 'E:/mcp' });
    expect(service.createRun).toHaveBeenCalledWith('E:/mcp');
    expect(response.data.runId).toBe('run-1');
  });

  it('appends a CLI run event', () => {
    const event: SseEvent = {
      type: 'progress',
      percent: 50,
      stage: 'generating'
    };
    const response = controller.appendCliRunEvent('run-1', event);
    expect(service.appendEvent).toHaveBeenCalledWith('run-1', event);
    expect(response.data.ok).toBe(true);
  });

  it('lists CLI runs', () => {
    const response = controller.listCliRuns();
    expect(service.getRunSummaries).toHaveBeenCalledTimes(1);
    expect(response.data[0]?.runId).toBe('run-1');
  });

  it('streams CLI run events', (done) => {
    const values: string[] = [];
    controller.streamCliRunEvents('run-1').subscribe((value) => {
      values.push(String(value.type));
      if (values.length === 2) {
        expect(service.getEvents).toHaveBeenCalledWith('run-1');
        expect(service.getEventStream).toHaveBeenCalledWith('run-1');
        expect(values).toEqual(['log', 'progress']);
        done();
      }
    });
  });
});
