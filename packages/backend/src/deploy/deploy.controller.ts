import type {
  ApiResponse,
  DeployExecuteRequest,
  DeployPreviewRequest,
  DeployPreview,
  DeployTask
} from '@mcp-claw/shared';
import { Body, Controller, Post } from '@nestjs/common';
import { DeployService } from './deploy.service';

@Controller('deploy')
export class DeployController {
  public constructor(private readonly deployService: DeployService) {}

  @Post('preview')
  public preview(@Body() req: DeployPreviewRequest): ApiResponse<DeployPreview> {
    return {
      code: 0,
      message: 'ok',
      data: this.deployService.preview(req)
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
}
