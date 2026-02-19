import type {
  DeployExecuteRequest,
  DeployPreview,
  DeployPreviewRequest,
  DeployTask,
  McpServer
} from '@sga/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { RuntimeService } from '../runtime/runtime.service';
import { SyncService } from '../sync/sync.service';
import { DockerService } from './docker.service';

@Injectable()
export class DeployService {
  private readonly taskStore = new Map<string, DeployTask>();
  private readonly workDir = path.join(process.cwd(), 'hub-packages');

  public constructor(
    private readonly syncService: SyncService,
    private readonly runtimeService: RuntimeService,
    private readonly dockerService: DockerService
  ) {}

  public async preview(req: DeployPreviewRequest): Promise<DeployPreview> {
    const servers = await this.resolveServers(req.serverIds);
    this.assertTokenBudget(servers);

    const previewServers = servers.map((server) => ({
      serverId: server.id,
      name: server.name,
      port: server.port,
      toolCount: server.toolCount
    }));

    const composeYaml = this.renderPreviewCompose(previewServers);
    const nginxConf = this.renderNginx(previewServers);

    return {
      composeYaml,
      nginxConf,
      servers: previewServers
    };
  }

  public async execute(req: DeployExecuteRequest): Promise<DeployTask> {
    const servers = await this.resolveServers(req.serverIds);
    this.assertTokenBudget(servers);

    const task: DeployTask = {
      id: `deploy-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      status: 'pending',
      serverIds: req.serverIds,
      startedAt: new Date().toISOString()
    };
    this.taskStore.set(task.id, task);

    void this.runDeployment(task.id, servers);

    return task;
  }

  public getTask(id: string): DeployTask {
    const task = this.taskStore.get(id);
    if (!task) {
      throw new NotFoundException(`Deploy task ${id} not found`);
    }
    return task;
  }

  private async runDeployment(taskId: string, servers: McpServer[]): Promise<void> {
    try {
      await mkdir(this.workDir, { recursive: true });
      this.updateStatus(taskId, 'pulling');

      const pulledPackages: Array<{
        server: McpServer;
        packageDir: string;
        containerName: string;
      }> = [];

      for (const server of servers) {
        const pulled = await this.syncService.pull(server.id);
        const packageDir = path.join(this.workDir, server.id);
        await mkdir(packageDir, { recursive: true });

        if (pulled.tarball.length > 0) {
          await this.extractTarballSafe(pulled.tarball, packageDir);
        }

        await this.writeDockerfile(packageDir, server.port);
        pulledPackages.push({
          server,
          packageDir,
          containerName: this.toContainerName(server.id)
        });
      }

      const composeFile = path.join(this.workDir, `compose-${taskId}.yml`);
      await writeFile(composeFile, this.renderRuntimeCompose(pulledPackages), 'utf8');

      const dockerReady = await this.dockerService.isDockerAvailable();
      if (!dockerReady) {
        throw new Error('Docker is not available');
      }

      this.updateStatus(taskId, 'starting');
      await this.dockerService.composeUp(composeFile);

      this.updateStatus(taskId, 'verifying');
      const allHealthy = await this.waitForContainers(
        pulledPackages.map((entry) => entry.containerName),
        30
      );

      this.updateStatus(taskId, allHealthy ? 'done' : 'failed');
    } catch {
      this.updateStatus(taskId, 'failed');
    }
  }

  private async resolveServers(serverIds: string[]): Promise<McpServer[]> {
    const allServers = await this.runtimeService.listServers();
    const byId = new Map(allServers.map((server) => [server.id, server]));
    const servers: McpServer[] = [];

    for (const id of serverIds) {
      const server = byId.get(id);
      if (!server) {
        throw new NotFoundException(`Server ${id} not found`);
      }
      servers.push(server);
    }

    return servers;
  }

  private assertTokenBudget(servers: McpServer[]): void {
    const totalTokenUsage = servers.reduce((sum, server) => sum + server.tokenUsage, 0);
    if (totalTokenUsage > 8000) {
      throw new BadRequestException(
        `Token budget exceeded: ${totalTokenUsage} > 8000. Reduce selected servers.`
      );
    }
  }

  private renderPreviewCompose(
    servers: Array<{ serverId: string; name: string; port: number; toolCount: number }>
  ): string {
    return [
      'version: "3.9"',
      'services:',
      ...servers.flatMap((server) => [
        `  ${this.toServiceName(server.serverId)}:`,
        '    image: node:20-alpine',
        '    working_dir: /app',
        '    volumes:',
        `      - ${this.workDir}/${server.serverId}:/app`,
        '    command: ["node", "server.js"]',
        '    ports:',
        `      - "${server.port}:${server.port}"`
      ])
    ].join('\n');
  }

  private renderNginx(
    servers: Array<{ serverId: string; name: string; port: number; toolCount: number }>
  ): string {
    return servers
      .map((server) => {
        return [
          `location /${server.serverId}/ {`,
          `  proxy_pass http://127.0.0.1:${server.port};`,
          '  proxy_http_version 1.1;',
          '  proxy_set_header Host $host;',
          '}'
        ].join('\n');
      })
      .join('\n');
  }

  private renderRuntimeCompose(
    packages: Array<{ server: McpServer; packageDir: string; containerName: string }>
  ): string {
    return [
      'version: "3.9"',
      'services:',
      ...packages.flatMap((entry) => [
        `  ${this.toServiceName(entry.server.id)}:`,
        '    build:',
        `      context: ${entry.packageDir.replace(/\\/g, '/')}`,
        '      dockerfile: Dockerfile',
        `    container_name: ${entry.containerName}`,
        '    restart: unless-stopped',
        '    ports:',
        `      - "${entry.server.port}:${entry.server.port}"`
      ])
    ].join('\n');
  }

  private toServiceName(id: string): string {
    return id.replace(/[^a-zA-Z0-9_.-]/g, '-');
  }

  private toContainerName(id: string): string {
    return `mcp-${this.toServiceName(id)}`;
  }

  private updateStatus(taskId: string, status: DeployTask['status']): void {
    const task = this.taskStore.get(taskId);
    if (!task) {
      return;
    }
    task.status = status;
  }

  private async writeDockerfile(packageDir: string, port: number): Promise<void> {
    const dockerfile = [
      'FROM node:20-alpine',
      'WORKDIR /app',
      'COPY . .',
      'RUN if [ -f package.json ]; then npm install --omit=dev; fi',
      `EXPOSE ${port}`,
      'CMD ["node","server.js"]'
    ].join('\n');

    await writeFile(path.join(packageDir, 'Dockerfile'), dockerfile, 'utf8');
  }

  private async waitForContainers(containerNames: string[], maxSeconds: number): Promise<boolean> {
    for (let attempt = 0; attempt < maxSeconds; attempt += 1) {
      const states = await Promise.all(
        containerNames.map((name) => this.dockerService.inspectContainer(name))
      );
      if (states.every((state) => state === 'running')) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  private async extractTarballSafe(buffer: Buffer, outputDir: string): Promise<void> {
    try {
      const tarData = gunzipSync(buffer);
      await this.extractTar(tarData, outputDir);
    } catch {
      // Keep empty directory when tarball is invalid or not gzip.
    }
  }

  private async extractTar(tarData: Buffer, outputDir: string): Promise<void> {
    let offset = 0;

    while (offset + 512 <= tarData.length) {
      const header = tarData.subarray(offset, offset + 512);
      offset += 512;

      if (header.every((byte) => byte === 0)) {
        break;
      }

      const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
      const sizeRaw = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
      const typeFlag = header.subarray(156, 157).toString('utf8') || '0';
      const size = sizeRaw ? Number.parseInt(sizeRaw, 8) || 0 : 0;
      const data = tarData.subarray(offset, offset + size);
      const resolvedPath = path.resolve(outputDir, rawName);

      if (!resolvedPath.startsWith(path.resolve(outputDir))) {
        offset += Math.ceil(size / 512) * 512;
        continue;
      }

      if (typeFlag === '5') {
        await mkdir(resolvedPath, { recursive: true });
      } else if (typeFlag === '0' || typeFlag === '\0') {
        await mkdir(path.dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, data);
      }

      offset += Math.ceil(size / 512) * 512;
    }
  }
}
