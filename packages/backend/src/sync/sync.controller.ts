import type { ApiResponse, Package, SyncPushResponse } from '@sga/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SyncService, type SyncPushInput, type SyncPushMetadata } from './sync.service';

interface SyncPushMultipartBody {
  metadata?: string;
}

interface UploadedTarballFile {
  buffer?: Buffer;
}

@Controller('sync')
export class SyncController {
  public constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @UseInterceptors(FileInterceptor('file'))
  public async push(
    @Body() body: SyncPushMultipartBody,
    @UploadedFile() file?: UploadedTarballFile
  ): Promise<ApiResponse<SyncPushResponse>> {
    const payload: SyncPushInput = {
      tarball: file?.buffer ?? Buffer.alloc(0),
      metadata: this.parseMetadata(body.metadata)
    };

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

  private parseMetadata(raw?: string): SyncPushMetadata {
    if (!raw) {
      throw new BadRequestException('metadata is required');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('metadata must be valid JSON');
    }

    if (!this.isMetadata(parsed)) {
      throw new BadRequestException('metadata is invalid');
    }

    return parsed;
  }

  private isMetadata(value: unknown): value is SyncPushMetadata {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<SyncPushMetadata>;
    return (
      typeof candidate.packageId === 'string' &&
      candidate.packageId.length > 0 &&
      !!candidate.manifest &&
      typeof candidate.manifest === 'object'
    );
  }
}
