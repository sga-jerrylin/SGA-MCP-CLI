import type { ApiResponse, McpServer, McpServerDetail, ToolsListResponse } from '@sga/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { RuntimeService } from './runtime.service';

@Controller('runtime')
export class RuntimeController {
  public constructor(private readonly runtimeService: RuntimeService) {}

  @Get('servers')
  public async listServers(): Promise<ApiResponse<McpServer[]>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.runtimeService.listServers()
    };
  }

  @Get('servers/:id')
  public async getServer(@Param('id') id: string): Promise<ApiResponse<McpServerDetail>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.runtimeService.getServer(id)
    };
  }

  @Get('servers/:id/tools')
  public async listTools(@Param('id') id: string): Promise<ApiResponse<ToolsListResponse>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.runtimeService.listTools(id)
    };
  }
}
