import type { ApiResponse, Artifact, GenerateRun, PaginatedList, Project } from '@mcp-claw/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { GeneratorService } from './generator.service';

interface CreateProjectBody {
  name: string;
  description?: string;
  docType?: 'markdown' | 'openapi' | 'auto';
}

@Controller('generator')
export class GeneratorController {
  private readonly projects: Project[] = [
    {
      id: 'proj-1',
      name: 'Demo Project',
      description: 'Seed project',
      status: 'pending',
      docType: 'markdown',
      toolCount: 0,
      createdAt: '2026-02-17T00:00:00.000Z',
      updatedAt: '2026-02-17T00:00:00.000Z'
    }
  ];

  private readonly artifactsByProject = new Map<string, Artifact[]>([
    [
      'proj-1',
      [
        {
          id: 'artifact-1',
          runId: 'run-1',
          type: 'package',
          fileName: 'mcp-package.tgz',
          size: 1024,
          createdAt: '2026-02-17T00:10:00.000Z'
        }
      ]
    ]
  ]);

  public constructor(private readonly generatorService: GeneratorService) {
    void this.generatorService;
  }

  @Get('projects')
  public listProjects(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): ApiResponse<PaginatedList<Project>> {
    const parsedPage = Number(page ?? '1');
    const parsedPageSize = Number(pageSize ?? '20');
    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const safePageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : 20;
    const start = (safePage - 1) * safePageSize;

    return {
      code: 0,
      message: 'ok',
      data: {
        items: this.projects.slice(start, start + safePageSize),
        total: this.projects.length,
        page: safePage,
        pageSize: safePageSize
      }
    };
  }

  @Post('projects')
  @UseInterceptors(FileInterceptor('file'))
  public createProject(
    @Body() body: CreateProjectBody,
    @UploadedFile() file?: { originalname?: string }
  ): ApiResponse<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: body.name,
      description: body.description ?? file?.originalname,
      status: 'pending',
      docType: body.docType ?? 'auto',
      toolCount: 0,
      createdAt: now,
      updatedAt: now
    };
    this.projects.unshift(project);

    return {
      code: 0,
      message: 'ok',
      data: project
    };
  }

  @Get('projects/:id')
  public getProject(@Param('id') id: string): ApiResponse<Project> {
    const project = this.projects.find((item) => item.id === id) ?? this.projects[0];
    return {
      code: 0,
      message: 'ok',
      data: project
    };
  }

  @Post('projects/:id/start')
  public startProject(@Param('id') id: string): ApiResponse<GenerateRun> {
    const run: GenerateRun = {
      id: `run-${Date.now()}`,
      projectId: id,
      status: 'running',
      parserModel: 'claude-3-haiku',
      coderModel: 'claude-3-5-sonnet',
      fixRounds: 0,
      startedAt: new Date().toISOString()
    };

    return {
      code: 0,
      message: 'ok',
      data: run
    };
  }

  @Sse('projects/:id/events')
  public streamEvents(@Param('id') id: string): Observable<{ type: string; data: unknown }> {
    const stages = ['parsing', 'generating', 'testing', 'fixing'] as const;

    return interval(1000).pipe(
      map((tick) => {
        if (tick === 0) {
          return {
            type: 'log',
            data: {
              type: 'log',
              level: 'info',
              message: `Project ${id} generation started`,
              timestamp: new Date().toISOString()
            }
          };
        }
        if (tick >= 1 && tick <= 4) {
          const percent = tick * 25;
          return {
            type: 'progress',
            data: {
              type: 'progress',
              percent,
              stage: stages[tick - 1]
            }
          };
        }
        return {
          type: 'done',
          data: {
            type: 'done',
            projectId: id,
            artifactCount: (this.artifactsByProject.get(id) ?? []).length
          }
        };
      })
    );
  }

  @Get('projects/:id/artifacts')
  public listArtifacts(@Param('id') id: string): ApiResponse<Artifact[]> {
    return {
      code: 0,
      message: 'ok',
      data: this.artifactsByProject.get(id) ?? []
    };
  }
}
