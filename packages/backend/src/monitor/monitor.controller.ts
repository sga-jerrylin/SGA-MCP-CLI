import type { ApiResponse, PaginatedList } from '@mcp-claw/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { AuditLog, MonitorService, SystemMetricsSnapshot } from './monitor.service';

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
}
