import type { DeployPreviewRequest, McpServer } from '@sga/shared';

import { buildComposeFromRequest } from './compose-from-contract';

describe('buildComposeFromRequest', () => {
  it('renders only selected servers from request', () => {
    const req: DeployPreviewRequest = { serverIds: ['s1'] };
    const servers: McpServer[] = [
      {
        id: 's1',
        name: 'S1',
        shardIndex: 1,
        status: 'healthy',
        toolCount: 5,
        tokenUsage: 100,
        tokenBudget: 8000,
        endpoint: 'http://localhost:8081',
        port: 8081,
        createdAt: new Date().toISOString()
      },
      {
        id: 's2',
        name: 'S2',
        shardIndex: 2,
        status: 'healthy',
        toolCount: 5,
        tokenUsage: 100,
        tokenBudget: 8000,
        endpoint: 'http://localhost:8082',
        port: 8082,
        createdAt: new Date().toISOString()
      }
    ];

    const yaml = buildComposeFromRequest(req, servers);
    expect(yaml).toContain('s1:');
    expect(yaml).not.toContain('s2:');
  });
});
