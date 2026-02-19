import type {
  ApiResponse,
  DeployExecuteRequest,
  DeployPreview,
  DeployPreviewRequest,
  DeployTask
} from '@sga/shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DeployService } from './deploy.service';

@Controller('deploy')
export class DeployController {
  public constructor(private readonly deployService: DeployService) {}

  @Post('preview')
  public async preview(@Body() req: DeployPreviewRequest): Promise<ApiResponse<DeployPreview>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.deployService.preview(req)
    };
  }

  @Post('execute')
  public async execute(@Body() req: DeployExecuteRequest): Promise<ApiResponse<DeployTask>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.deployService.execute(req)
    };
  }

  @Get('tasks/:id')
  public getTask(@Param('id') id: string): ApiResponse<DeployTask> {
    return {
      code: 0,
      message: 'ok',
      data: this.deployService.getTask(id)
    };
  }
}
