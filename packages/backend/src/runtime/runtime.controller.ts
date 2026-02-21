import type { ApiResponse, McpServer, McpServerDetail, ToolsListResponse } from '@sga/shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthVaultService } from '../auth-vault/auth-vault.service';
import { CredentialEntity } from '../auth-vault/entities/credential.entity';
import { RuntimeService } from './runtime.service';

interface SaveCredentialsRequest {
  credentials: Record<string, string>;
}

interface SaveCredentialsResponse {
  packageId: string;
  savedKeys: string[];
}

@Controller('runtime')
export class RuntimeController {
  public constructor(
    private readonly runtimeService: RuntimeService,
    private readonly authVaultService: AuthVaultService,
    @InjectRepository(CredentialEntity)
    private readonly credentialRepo: Repository<CredentialEntity>
  ) {}

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

  @Post('credentials/:packageId')
  public async saveCredentials(
    @Param('packageId') packageId: string,
    @Body() body: SaveCredentialsRequest
  ): Promise<ApiResponse<SaveCredentialsResponse>> {
    const credentials = body?.credentials ?? {};
    const savedKeys: string[] = [];

    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value !== 'string') {
        continue;
      }
      await this.authVaultService.setCredential({
        tenantId: 'default',
        serverId: packageId,
        keyName: key,
        plaintext: value,
        keyVersion: 1
      });
      savedKeys.push(key);
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        packageId,
        savedKeys
      }
    };
  }

  @Get('credentials/:packageId')
  public async listCredentialKeys(
    @Param('packageId') packageId: string
  ): Promise<ApiResponse<{ keys: string[] }>> {
    const rows = await this.credentialRepo.find({
      where: { serverId: packageId },
      select: { keyName: true }
    });

    return {
      code: 0,
      message: 'ok',
      data: { keys: rows.map((row) => row.keyName) }
    };
  }

  @Delete('credentials/:packageId/:key')
  public async deleteCredential(
    @Param('packageId') packageId: string,
    @Param('key') key: string
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const deleted = await this.authVaultService.deleteCredential('default', packageId, key);

    return {
      code: 0,
      message: 'ok',
      data: { deleted }
    };
  }
}
