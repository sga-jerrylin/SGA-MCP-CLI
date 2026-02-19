import { delay, http, HttpResponse } from 'msw';
import type {
  ApiKey,
  ApiResponse,
  Artifact,
  CreateApiKeyResponse,
  DeployPreview,
  DeployTask,
  GenerateRun,
  LoginResponse,
  McpServer,
  McpServerDetail,
  McpTool,
  Metrics,
  Package,
  PaginatedList,
  Project,
  ProjectDetail,
  SseDoneEvent,
  SseLogEvent,
  SseProgressEvent,
  SseStepChangeEvent,
  Tenant,
  ToolsListResponse,
  User
} from '@sga/shared';

interface AuditLog {
  id: string;
  action: string;
  userId: string;
  resource: string;
  createdAt: string;
}

const ARTIFICIAL_DELAY = 300;

const nowIso = () => new Date().toISOString();
const ok = <T>(data: T): ApiResponse<T> => ({ code: 0, message: 'ok', data });

const mockUser: User = {
  id: 'u_001',
  username: 'admin',
  role: 'admin',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  tenantId: 'tenant_001'
};

const mockProjects: Project[] = [
  {
    id: 'p_001',
    name: 'WeCom Messaging Tools',
    description: 'Send enterprise notifications via WeCom',
    status: 'done',
    docType: 'markdown',
    toolCount: 12,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'p_002',
    name: 'U8 Voucher APIs',
    description: 'Finance voucher integration',
    status: 'generating',
    docType: 'openapi',
    toolCount: 8,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

const mockArtifactsByProject = new Map<string, Artifact[]>([
  [
    'p_001',
    [
      {
        id: 'a_001',
        runId: 'r_001',
        type: 'connector',
        fileName: 'wecom.connector.ts',
        size: 2458,
        createdAt: nowIso()
      },
      {
        id: 'a_002',
        runId: 'r_001',
        type: 'package',
        fileName: 'wecom-package.tgz',
        size: 16432,
        createdAt: nowIso()
      }
    ]
  ]
]);

const mockPackages: Package[] = [
  {
    id: 'pkg-erp-finance',
    name: 'ERP Finance Package',
    version: '1.0.0',
    description: 'ERP finance tools',
    category: 'erp',
    toolCount: 18,
    serverCount: 1,
    sha256: 'a'.repeat(64),
    signature: 'sig-erp',
    signed: true,
    downloads: 120,
    publishedAt: nowIso()
  },
  {
    id: 'pkg-wecom',
    name: 'WeCom Connector Package',
    version: '1.2.1',
    description: 'WeCom messaging suite',
    category: 'wecom',
    toolCount: 10,
    serverCount: 1,
    sha256: 'b'.repeat(64),
    signature: 'sig-wecom',
    signed: true,
    downloads: 80,
    publishedAt: nowIso()
  }
];

const mockServers: McpServer[] = Array.from({ length: 13 }).map((_, index) => ({
  id: `srv_${index + 1}`,
  name: `Server ${index + 1}`,
  shardIndex: index + 1,
  status: index % 4 === 0 ? 'degraded' : 'healthy',
  toolCount: 12 + index,
  tokenUsage: 3200 + index * 160,
  tokenBudget: 8000,
  endpoint: `http://localhost:${8080 + index + 1}`,
  port: 8080 + index + 1,
  createdAt: nowIso()
}));

const makeTools = (serverId: string): McpTool[] => [
  { name: `${serverId}.list`, description: `List resources for ${serverId}` },
  { name: `${serverId}.get`, description: `Get resource for ${serverId}` }
];

const mockServerDetails = new Map<string, McpServerDetail>(
  mockServers.map((server) => [
    server.id,
    {
      ...server,
      tools: makeTools(server.id),
      metrics: {
        qps: 10 + server.shardIndex,
        p95Latency: 120 + server.shardIndex,
        errorRate: Number((0.01 * (server.shardIndex % 3)).toFixed(2))
      }
    }
  ])
);

const mockTenants: Tenant[] = [
  {
    id: 'tenant_001',
    name: 'Acme Corp',
    contact: 'admin@acme.com',
    status: 'active',
    createdAt: nowIso()
  }
];

const mockKeysByTenant = new Map<string, ApiKey[]>([
  [
    'tenant_001',
    [
      {
        id: 'key_001',
        name: 'Default Key',
        prefix: 'mcp_demo',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      }
    ]
  ]
]);

const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit_001',
    action: 'repo.install',
    userId: 'u_001',
    resource: 'pkg-erp-finance',
    createdAt: nowIso()
  },
  {
    id: 'audit_002',
    action: 'deploy.execute',
    userId: 'u_001',
    resource: 'srv_1',
    createdAt: nowIso()
  }
];

export const handlers = [
  http.post('/api/auth/login', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json(ok<LoginResponse>({ token: 'mock-jwt-token-xyz', user: mockUser }));
  }),

  http.get('/api/auth/me', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json(ok<User>(mockUser));
  }),

  http.get('/api/generator/projects', async ({ request }) => {
    await delay(ARTIFICIAL_DELAY);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
    const start = (safePage - 1) * safeSize;

    const data: PaginatedList<Project> = {
      items: mockProjects.slice(start, start + safeSize),
      total: mockProjects.length,
      page: safePage,
      pageSize: safeSize
    };

    return HttpResponse.json(ok(data));
  }),

  http.post('/api/generator/projects', async () => {
    await delay(ARTIFICIAL_DELAY);
    const project: Project = {
      id: `p_${Date.now()}`,
      name: 'Imported Project',
      description: 'Generated from uploaded document',
      status: 'pending',
      docType: 'auto',
      toolCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    mockProjects.unshift(project);
    return HttpResponse.json(ok<Project>(project));
  }),

  http.get('/api/generator/projects/:id', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const projectId = String(params.id);
    const project = mockProjects.find((item) => item.id === projectId) ?? mockProjects[0];

    const detail: ProjectDetail = {
      ...project,
      runs: [
        {
          id: 'r_001',
          projectId: project.id,
          status: 'done',
          parserModel: 'claude-3-haiku',
          coderModel: 'claude-3-5-sonnet',
          fixRounds: 1,
          startedAt: nowIso(),
          finishedAt: nowIso()
        }
      ],
      artifacts: mockArtifactsByProject.get(project.id) ?? []
    };

    return HttpResponse.json(ok<ProjectDetail>(detail));
  }),

  http.post('/api/generator/projects/:id/start', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const run: GenerateRun = {
      id: `r_${Date.now()}`,
      projectId: String(params.id),
      status: 'queued',
      parserModel: 'claude-3-haiku',
      coderModel: 'claude-3-5-sonnet',
      fixRounds: 0,
      startedAt: nowIso()
    };

    return HttpResponse.json(ok<GenerateRun>(run));
  }),

  http.get('/api/generator/projects/:id/events', async ({ params }) => {
    const projectId = String(params.id);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, payload: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        };

        const stages: Array<SseProgressEvent['stage']> = [
          'parsing',
          'generating',
          'testing',
          'fixing'
        ];

        for (let index = 0; index < stages.length; index += 1) {
          const logEvent: SseLogEvent = {
            type: 'log',
            level: 'info',
            message: `Stage ${index + 1}: ${stages[index]}`,
            timestamp: nowIso()
          };
          send('log', logEvent);

          const progressEvent: SseProgressEvent = {
            type: 'progress',
            percent: (index + 1) * 25,
            stage: stages[index]
          };
          send('progress', progressEvent);

          const stepChange: SseStepChangeEvent = {
            type: 'step_change',
            step: index + 1,
            name: stages[index],
            status: 'running'
          };
          send('step_change', stepChange);

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const doneEvent: SseDoneEvent = {
          type: 'done',
          projectId,
          artifactCount: (mockArtifactsByProject.get(projectId) ?? []).length
        };
        send('done', doneEvent);
        controller.close();
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  }),

  http.get('/api/generator/projects/:id/artifacts', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const projectId = String(params.id);
    const artifacts = mockArtifactsByProject.get(projectId) ?? [];
    return HttpResponse.json(ok<Artifact[]>(artifacts));
  }),

  http.get('/api/runtime/servers', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json(ok<McpServer[]>(mockServers));
  }),

  http.get('/api/runtime/servers/:id', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const serverId = String(params.id);
    const detail = mockServerDetails.get(serverId) ?? Array.from(mockServerDetails.values())[0];
    return HttpResponse.json(ok<McpServerDetail>(detail));
  }),

  http.get('/api/runtime/servers/:id/tools', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const serverId = String(params.id);
    const detail = mockServerDetails.get(serverId) ?? Array.from(mockServerDetails.values())[0];

    const data: ToolsListResponse = {
      tools: detail.tools,
      tokenUsage: detail.tokenUsage,
      tokenBudget: detail.tokenBudget
    };

    return HttpResponse.json(ok<ToolsListResponse>(data));
  }),

  http.post('/api/deploy/preview', async () => {
    await delay(ARTIFICIAL_DELAY);
    const data: DeployPreview = {
      composeYaml: 'version: "3.9"\nservices:\n  mcp-server-1:\n    image: mcp/server:latest',
      nginxConf: 'server { listen 80; location / { proxy_pass http://mcp-server-1:8081; } }',
      servers: [{ serverId: 'srv_1', name: 'Server 1', port: 8081, toolCount: 12 }]
    };

    return HttpResponse.json(ok<DeployPreview>(data));
  }),

  http.post('/api/deploy/execute', async () => {
    await delay(ARTIFICIAL_DELAY);
    const data: DeployTask = {
      id: `task_${Date.now()}`,
      status: 'pending',
      serverIds: ['srv_1'],
      startedAt: nowIso()
    };

    return HttpResponse.json(ok<DeployTask>(data));
  }),

  http.get('/api/repo/packages', async ({ request }) => {
    await delay(ARTIFICIAL_DELAY);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
    const start = (safePage - 1) * safeSize;

    const data: PaginatedList<Package> = {
      items: mockPackages.slice(start, start + safeSize),
      total: mockPackages.length,
      page: safePage,
      pageSize: safeSize
    };

    return HttpResponse.json(ok<PaginatedList<Package>>(data));
  }),

  http.get('/api/repo/packages/:id', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const packageId = String(params.id);
    const pkg = mockPackages.find((item) => item.id === packageId) ?? mockPackages[0];
    return HttpResponse.json(ok<Package>(pkg));
  }),

  http.post('/api/repo/packages/:id/install', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const packageId = String(params.id);
    return HttpResponse.json(ok({ downloadUrl: `https://mock.storage.local/${packageId}.tgz` }));
  }),

  http.get('/api/admin/tenants', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json(ok<Tenant[]>(mockTenants));
  }),

  http.post('/api/admin/tenants', async ({ request }) => {
    await delay(ARTIFICIAL_DELAY);
    const body = (await request.json()) as Partial<Tenant> & { name?: string; contact?: string };

    const tenant: Tenant = {
      id: `tenant_${Date.now()}`,
      name: body.name ?? 'New Tenant',
      contact: body.contact ?? 'owner@example.com',
      status: 'active',
      createdAt: nowIso()
    };

    mockTenants.push(tenant);
    mockKeysByTenant.set(tenant.id, []);
    return HttpResponse.json(ok<Tenant>(tenant));
  }),

  http.get('/api/admin/tenants/:tenantId/keys', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const tenantId = String(params.tenantId);
    const keys = mockKeysByTenant.get(tenantId) ?? [];
    return HttpResponse.json(ok<ApiKey[]>(keys));
  }),

  http.post('/api/admin/tenants/:tenantId/keys', async ({ params, request }) => {
    await delay(ARTIFICIAL_DELAY);
    const tenantId = String(params.tenantId);
    const body = (await request.json()) as { name?: string; expiresIn?: string };

    const keyValue = `mcp_${Math.random().toString(16).slice(2, 18)}`;
    const response: CreateApiKeyResponse = {
      id: `key_${Date.now()}`,
      name: body.name ?? 'Generated Key',
      key: keyValue,
      prefix: keyValue.slice(0, 8),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    };

    const current = mockKeysByTenant.get(tenantId) ?? [];
    current.push({
      id: response.id,
      name: response.name,
      prefix: response.prefix,
      expiresAt: response.expiresAt,
      status: 'active'
    });
    mockKeysByTenant.set(tenantId, current);

    return HttpResponse.json(ok<CreateApiKeyResponse>(response));
  }),

  http.delete('/api/admin/tenants/:tenantId/keys/:keyId', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const tenantId = String(params.tenantId);
    const keyId = String(params.keyId);
    const current = mockKeysByTenant.get(tenantId) ?? [];
    mockKeysByTenant.set(
      tenantId,
      current.map((key) => (key.id === keyId ? { ...key, status: 'revoked' as const } : key))
    );

    return HttpResponse.json(ok({ revoked: true }));
  }),

  http.get('/api/monitor/metrics', async () => {
    await delay(ARTIFICIAL_DELAY);
    const data: Metrics = {
      summary: {
        totalServers: 13,
        activeServers: 11,
        totalTools: 182,
        totalRequests: 50210
      },
      qps: Array.from({ length: 12 }).map((_, index) => ({
        timestamp: new Date(Date.now() - index * 60_000).toISOString(),
        value: 60 + index
      })),
      latency: Array.from({ length: 12 }).map((_, index) => ({
        timestamp: new Date(Date.now() - index * 60_000).toISOString(),
        p50: 40 + index,
        p95: 110 + index,
        p99: 180 + index
      })),
      memory: Array.from({ length: 12 }).map((_, index) => ({
        timestamp: new Date(Date.now() - index * 60_000).toISOString(),
        usedMb: 450 + index,
        totalMb: 1024
      }))
    };

    return HttpResponse.json(ok<Metrics>(data));
  }),

  http.get('/api/monitor/audit-logs', async ({ request }) => {
    await delay(ARTIFICIAL_DELAY);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
    const start = (safePage - 1) * safeSize;

    const data: PaginatedList<AuditLog> = {
      items: mockAuditLogs.slice(start, start + safeSize),
      total: mockAuditLogs.length,
      page: safePage,
      pageSize: safeSize
    };

    return HttpResponse.json(ok<PaginatedList<AuditLog>>(data));
  })
];
