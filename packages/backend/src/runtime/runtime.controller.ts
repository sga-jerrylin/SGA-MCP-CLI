import type { ApiResponse, McpServer, McpServerDetail, ToolsListResponse } from '@mcp-claw/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { RuntimeService } from './runtime.service';

@Controller('runtime')
export class RuntimeController {
  public constructor(private readonly runtimeService: RuntimeService) {}

  @Get('servers')
  public listServers(): ApiResponse<McpServer[]> {
    return {
      code: 0,
      message: 'ok',
      data: this.runtimeService.listServers()
    };
  }

  @Get('servers/:id')
  public getServer(@Param('id') id: string): ApiResponse<McpServerDetail> {
    return {
      code: 0,
      message: 'ok',
      data: this.runtimeService.getServer(id)
    };
  }

  @Get('servers/:id/tools')
  public listTools(@Param('id') id: string): ApiResponse<ToolsListResponse> {
    return {
      code: 0,
      message: 'ok',
      data: this.runtimeService.listTools(id)
    };
  }
}
