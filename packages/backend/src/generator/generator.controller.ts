import type { PackageBuildResult } from '@sga/core';
import type { ApiResponse, Artifact, GenerateRun, PaginatedList, Project } from '@sga/shared';
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

interface UploadedDocumentFile {
  originalname?: string;
  buffer?: Buffer;
}

@Controller('generator')
export class GeneratorController {
  private readonly projectContents = new Map<string, string>();
  private readonly runResults = new Map<string, PackageBuildResult>();
  private readonly latestRunByProject = new Map<string, string>();

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
    this.projectContents.set(
      'proj-1',
      [
        '- System Code: demo_system',
        '- Base URL: https://api.example.com',
        '- Auth Type: none',
        '',
        '## Tool: list_items',
        '- Method: GET',
        '- Path: /items',
        '- Description: List items'
      ].join('\n')
    );
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
    @UploadedFile() file?: UploadedDocumentFile
  ): ApiResponse<Project> {
    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}`;
    const project: Project = {
      id: projectId,
      name: body.name,
      description: body.description ?? file?.originalname,
      status: 'pending',
      docType: body.docType ?? 'auto',
      toolCount: 0,
      createdAt: now,
      updatedAt: now
    };
    this.projects.unshift(project);

    const fileContent =
      file?.buffer?.toString('utf8') ?? body.description ?? file?.originalname ?? '';
    this.projectContents.set(projectId, fileContent);

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
    const targetProject = this.projects.find((item) => item.id === id);
    const run: GenerateRun = {
      id: `run-${Date.now()}`,
      projectId: id,
      status: 'running',
      parserModel: process.env.LLM_PARSER_MODEL ?? 'anthropic/claude-haiku-4.5',
      coderModel: process.env.LLM_CODER_MODEL ?? 'openai/gpt-5.2-codex',
      fixRounds: 0,
      startedAt: new Date().toISOString()
    };

    const fallbackContent = [
      '- System Code: generated_system',
      '- Base URL: https://api.generated.local',
      '- Auth Type: none',
      '',
      '## Tool: health_check',
      '- Method: GET',
      '- Path: /health',
      '- Description: Health check'
    ].join('\n');

    const content =
      this.projectContents.get(id) ??
      targetProject?.description ??
      targetProject?.name ??
      fallbackContent;

    Promise.resolve(this.generatorService.generateFromDoc(content))
      .then((result) => {
        if (!result) {
          return;
        }

        this.runResults.set(run.id, result);
        this.latestRunByProject.set(id, run.id);
        this.artifactsByProject.set(id, this.buildArtifactsFromResult(run.id, result));

        if (targetProject) {
          targetProject.status = 'done';
          targetProject.updatedAt = new Date().toISOString();
        }
      })
      .catch(() => {
        if (targetProject) {
          targetProject.status = 'failed';
          targetProject.updatedAt = new Date().toISOString();
        }
      });

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
    const latestRunId = this.latestRunByProject.get(id);
    if (latestRunId) {
      const result = this.runResults.get(latestRunId);
      if (result) {
        return {
          code: 0,
          message: 'ok',
          data: this.buildArtifactsFromResult(latestRunId, result)
        };
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: this.artifactsByProject.get(id) ?? []
    };
  }

  private buildArtifactsFromResult(runId: string, result: PackageBuildResult): Artifact[] {
    const createdAt = new Date().toISOString();
    const entries: Array<{ type: Artifact['type']; fileName: string }> = [
      { type: 'package', fileName: result.archivePath },
      { type: 'config', fileName: result.manifestPath },
      { type: 'config', fileName: result.sbomPath },
      { type: 'config', fileName: result.signaturePath }
    ];

    return entries.map((entry, index) => ({
      id: `${runId}-artifact-${index + 1}`,
      runId,
      type: entry.type,
      fileName: entry.fileName,
      size: entry.fileName.length,
      createdAt
    }));
  }
}
