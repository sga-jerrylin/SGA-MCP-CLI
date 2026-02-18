import type { ApiResponse, PaginatedList, SseEvent } from '@mcp-claw/shared';
import { Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import { AgentRunSummary, AuditLog, MonitorService, SystemMetricsSnapshot } from './monitor.service';

interface CreateCliRunRequest {
  root: string;
}

@Controller('monitor')
export class MonitorController {
  public constructor(private readonly monitorService: MonitorService) {}

  @Get('metrics')
  public getMetrics(): ApiResponse<SystemMetricsSnapshot> {
    return {
      code: 0,
      message: 'ok',
      data: this.monitorService.getMetrics()
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
}
