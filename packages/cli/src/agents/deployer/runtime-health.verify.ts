import type { McpServerDetail } from '@mcp-claw/shared';

export async function verifyServers(
  servers: McpServerDetail[]
): Promise<{ ok: boolean; failed: string[] }> {
  const failed = servers.filter((server) => server.status !== 'healthy').map((server) => server.id);

  return {
    ok: failed.length === 0,
    failed
  };
}
