import type { PaginatedList, SseEvent } from '@mcp-claw/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';

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

export interface AgentRun {
  runId: string;
  root: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  events: SseEvent[];
}

export interface AgentRunSummary {
  runId: string;
  root: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  eventCount: number;
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

  private readonly agentRuns = new Map<string, AgentRun>();
  private readonly eventStreams = new Map<string, Subject<SseEvent>>();

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

  public createRun(root: string): string {
    const runId = `run_${Date.now()}`;
    const run: AgentRun = {
      runId,
      root,
      status: 'running',
      startedAt: new Date().toISOString(),
      events: []
    };

    this.agentRuns.set(runId, run);
    this.eventStreams.set(runId, new Subject<SseEvent>());
    return runId;
  }

  public appendEvent(runId: string, event: SseEvent): void {
    const run = this.agentRuns.get(runId);
    if (!run) {
      throw new NotFoundException(`CLI run not found: ${runId}`);
    }

    run.events.push(event);
    if (event.type === 'done') {
      run.status = 'done';
    } else if (event.type === 'error') {
      run.status = 'error';
    } else {
      run.status = 'running';
    }

    const stream = this.eventStreams.get(runId);
    stream?.next(event);
  }

  public getRuns(): AgentRun[] {
    return Array.from(this.agentRuns.values()).sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    );
  }

  public getRunSummaries(): AgentRunSummary[] {
    return Array.from(this.agentRuns.values())
      .map((run) => ({
        runId: run.runId,
        root: run.root,
        status: run.status,
        startedAt: run.startedAt,
        eventCount: run.events.length
      }))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  public getEvents(runId: string): SseEvent[] {
    const run = this.agentRuns.get(runId);
    if (!run) {
      throw new NotFoundException(`CLI run not found: ${runId}`);
    }

    return [...run.events];
  }

  public getEventStream(runId: string): Subject<SseEvent> {
    const stream = this.eventStreams.get(runId);
    if (!stream) {
      throw new NotFoundException(`CLI run not found: ${runId}`);
    }

    return stream;
  }
}
