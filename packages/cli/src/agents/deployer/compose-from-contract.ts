import type { DeployPreviewRequest, McpServer } from '@sga/shared';

import { renderCompose } from './compose.renderer';

export function buildComposeFromRequest(req: DeployPreviewRequest, servers: McpServer[]): string {
  const selected = servers
    .filter((server) => req.serverIds.includes(server.id))
    .map((server) => ({
      name: server.id,
      image: 'mcp-claw/mcp-server:latest',
      port: server.port
    }));

  return renderCompose(selected);
}
