import type { IR, IrTool } from '@mcp-claw/core';

import type { ExplorerReport } from '../explorer/explorer.agent';

function toToolName(pathname: string): string {
  const normalized = pathname.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return normalized || 'root';
}

function toTool(endpoint: ExplorerReport['endpoints'][number]): IrTool {
  const parsed = new URL(endpoint.url);
  return {
    name: toToolName(parsed.pathname),
    description: `GET ${parsed.pathname}`,
    method: 'GET',
    path: parsed.pathname || '/',
    needsConfirmation: false,
    isAsync: false,
    params: []
  };
}

export function buildIRFromDiscovery(report: ExplorerReport): IR {
  const firstUrl = report.endpoints[0]?.url ?? 'https://example.com';
  const baseUrl = new URL(firstUrl).origin;

  return {
    system: {
      code: 'target-system',
      baseUrl,
      authType: 'none'
    },
    tools: report.endpoints.map(toTool)
  };
}
