import type { ApiResponse, Package, PaginatedList } from '@mcp-claw/shared';
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RepoService } from './repo.service';

@Controller('repo')
export class RepoController {
  public constructor(private readonly repoService: RepoService) {}

  @Get('packages')
  public listPackages(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): ApiResponse<PaginatedList<Package>> {
    const parsedPage = Number(page ?? '1');
    const parsedPageSize = Number(pageSize ?? '20');

    return {
      code: 0,
      message: 'ok',
      data: this.repoService.listPackages(parsedPage, parsedPageSize)
    };
  }

  @Get('packages/:id')
  public getPackage(@Param('id') id: string): ApiResponse<Package> {
    return {
      code: 0,
      message: 'ok',
      data: this.repoService.getPackage(id)
    };
  }

  @Post('packages/:id/install')
  public async installPackage(
    @Param('id') id: string
  ): Promise<ApiResponse<{ downloadUrl: string }>> {
    return {
      code: 0,
      message: 'ok',
      data: await this.repoService.installPackage(id)
    };
  }
}
