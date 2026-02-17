import type {
  ApiResponse,
  DeployExecuteRequest,
  DeployPreview,
  DeployTask
} from '@mcp-claw/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DeployService } from './deploy.service';

@Controller('deploy')
export class DeployController {
  public constructor(private readonly deployService: DeployService) {}

  @Get('preview')
  public preview(@Query('serverIds') serverIds?: string | string[]): ApiResponse<DeployPreview> {
    const normalizedIds = this.normalizeServerIds(serverIds);
    return {
      code: 0,
      message: 'ok',
      data: this.deployService.preview({ serverIds: normalizedIds })
    };
  }

  @Post('execute')
  public execute(@Body() req: DeployExecuteRequest): ApiResponse<DeployTask> {
    return {
      code: 0,
      message: 'ok',
      data: this.deployService.execute(req)
    };
  }

  private normalizeServerIds(serverIds?: string | string[]): string[] {
    if (Array.isArray(serverIds)) {
      return serverIds;
    }
    if (typeof serverIds === 'string' && serverIds.length > 0) {
      return serverIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
    return [];
  }
}
