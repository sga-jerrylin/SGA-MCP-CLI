import type { McpServerDetail } from '@mcp-claw/shared';

import { verifyServers } from './runtime-health.verify';

describe('verifyServers', () => {
  it('returns failed ids for unhealthy servers', async () => {
    const servers = [
      { id: 's1', status: 'healthy' },
      { id: 's2', status: 'degraded' }
    ] as McpServerDetail[];

    const result = await verifyServers(servers);
    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['s2']);
  });
});
