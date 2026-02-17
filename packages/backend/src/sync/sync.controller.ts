import type { ApiResponse, Package, SyncPushResponse } from '@mcp-claw/shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SyncService, type SyncPushPayload } from './sync.service';

@Controller('sync')
export class SyncController {
  public constructor(private readonly syncService: SyncService) {}

  @Post('push')
  // TODO: align with api-contract.yaml multipart/form-data format
  public async push(@Body() payload: SyncPushPayload): Promise<ApiResponse<SyncPushResponse>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.syncService.push(payload)
    };
  }

  @Get('pull/:packageId')
  public async pull(
    @Param('packageId') packageId: string
  ): Promise<ApiResponse<{ tarball: Buffer; manifest: Package }>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.syncService.pull(packageId)
    };
  }
}
