import type { ApiResponse, Package, PaginatedList } from '@sga/shared';
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RepoService } from './repo.service';

@Controller('repo')
export class RepoController {
  public constructor(private readonly repoService: RepoService) {}

  @Get('packages')
  public async listPackages(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): Promise<ApiResponse<PaginatedList<Package>>> {
    const parsedPage = Number(page ?? '1');
    const parsedPageSize = Number(pageSize ?? '20');

    return {
      code: 0,
      message: 'ok',
      data: await this.repoService.listPackages(parsedPage, parsedPageSize)
    };
  }

  @Get('packages/:id')
  public async getPackage(@Param('id') id: string): Promise<ApiResponse<Package>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.repoService.getPackage(id)
    };
  }

  @Post('packages/:id/install')
  public async installPackage(
    @Param('id') id: string
  ): Promise<ApiResponse<{ packageId: string; pullUrl: string; manifest: Package }>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.repoService.installPackage(id)
    };
  }
}
