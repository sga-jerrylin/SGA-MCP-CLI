import type {
  DeployExecuteRequest,
  DeployPreview,
  DeployPreviewRequest,
  DeployTask
} from '@mcp-claw/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeployService {
  public preview(req: DeployPreviewRequest): DeployPreview {
    const servers = req.serverIds.map((serverId, index) => ({
      serverId,
      name: `Server ${serverId}`,
      port: 8080 + index,
      toolCount: 20
    }));

    const composeYaml = [
      'version: "3.9"',
      'services:',
      ...servers.flatMap((server) => [
        `  ${server.serverId}:`,
        `    image: mcp-claw/${server.serverId}:latest`,
        '    ports:',
        `      - "${server.port}:${server.port}"`
      ])
    ].join('\n');

    const nginxConf = servers
      .map(
        (server) => `location /${server.serverId}/ { proxy_pass http://127.0.0.1:${server.port}; }`
      )
      .join('\n');

    return {
      composeYaml,
      nginxConf,
      servers
    };
  }

  public execute(req: DeployExecuteRequest): DeployTask {
    return {
      id: `deploy-${Date.now()}`,
      status: 'pending',
      serverIds: req.serverIds,
      startedAt: new Date().toISOString()
    };
  }
}
