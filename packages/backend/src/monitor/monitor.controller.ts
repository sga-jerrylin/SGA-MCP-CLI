import type { ApiResponse, PaginatedList, SseEvent } from '@sga/shared';
import { Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import {
  AgentRunSummary,
  AuditLog,
  DashboardSummary,
  MonitorService,
  SystemMetricsSnapshot,
  ToolCallStat
} from './monitor.service';

interface CreateCliRunRequest {
  root: string;
}

interface RecordToolCallRequest {
  serverId: string;
  serverName: string;
  toolName: string;
  durationMs?: number;
}

@Controller('monitor')
export class MonitorController {
  public constructor(private readonly monitorService: MonitorService) {}

  @Get('metrics')
  public async getMetrics(): Promise<ApiResponse<SystemMetricsSnapshot>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.monitorService.getMetrics()
    };
  }

  @Get('audit-logs')
  public getAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): ApiResponse<PaginatedList<AuditLog>> {
    const parsedPage = Number(page ?? '1');
    const parsedPageSize = Number(pageSize ?? '20');

    return {
      code: 0,
      message: 'ok',
      data: this.monitorService.getAuditLogs(parsedPage, parsedPageSize)
    };
  }

  @Post('cli-runs')
  public createCliRun(@Body() body: CreateCliRunRequest): ApiResponse<{ runId: string }> {
    const runId = this.monitorService.createRun(body.root);
    return {
      code: 0,
      message: 'ok',
      data: { runId }
    };
  }

  @Post('cli-runs/:runId/events')
  public appendCliRunEvent(
    @Param('runId') runId: string,
    @Body() event: SseEvent
  ): ApiResponse<{ ok: boolean }> {
    this.monitorService.appendEvent(runId, event);
    return {
      code: 0,
      message: 'ok',
      data: { ok: true }
    };
  }

  @Get('cli-runs')
  public listCliRuns(): ApiResponse<AgentRunSummary[]> {
    return {
      code: 0,
      message: 'ok',
      data: this.monitorService.getRunSummaries()
    };
  }

  @Sse('cli-runs/:runId/events')
  public streamCliRunEvents(@Param('runId') runId: string): Observable<MessageEvent> {
    const history = this.monitorService.getEvents(runId);
    const historyEvents = from(history).pipe(map((event) => ({ type: event.type, data: event })));
    const liveEvents = this.monitorService
      .getEventStream(runId)
      .asObservable()
      .pipe(map((event) => ({ type: event.type, data: event })));

    return concat(historyEvents, liveEvents);
  }

  @Post('tool-calls')
  public recordToolCall(@Body() body: RecordToolCallRequest): ApiResponse<{ ok: boolean }> {
    this.monitorService.recordToolCall(
      body.serverId,
      body.serverName,
      body.toolName,
      body.durationMs
    );

    return {
      code: 0,
      message: 'ok',
      data: { ok: true }
    };
  }

  @Get('tool-stats')
  public getToolStats(): ApiResponse<ToolCallStat[]> {
    return {
      code: 0,
      message: 'ok',
      data: this.monitorService.getToolStats()
    };
  }

  @Get('dashboard')
  public async getDashboard(): Promise<ApiResponse<DashboardSummary>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.monitorService.getDashboardSummary()
    };
  }
}
