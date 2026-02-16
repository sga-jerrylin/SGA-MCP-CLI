import { http, HttpResponse, delay } from 'msw';
import type {
  ApiResponse,
  LoginResponse,
  User,
  PaginatedList,
  Project,
  ProjectDetail,
  GenerateRun,
  McpServer,
  DeployPreview,
  DeployTask,
  Metrics,
  Tenant,
  ApiKey,
  SseLogEvent,
  SseProgressEvent,
  SseDoneEvent
} from '@mcp-claw/shared';

// 模拟延迟
const ARTIFICIAL_DELAY = 500;

// Mock Data
const mockUser: User = {
  id: 'u_001',
  username: 'admin',
  role: 'admin',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  tenantId: 't_001'
};

const mockProjects: Project[] = [
  {
    id: 'p_001',
    name: '企业微信消息工具',
    description: '集成企业微信消息发送能力',
    status: 'done',
    docType: 'markdown',
    toolCount: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'p_002',
    name: '用友 U8 凭证接口',
    description: '财务系统凭证对接',
    status: 'generating',
    docType: 'openapi',
    toolCount: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockServers: McpServer[] = Array.from({ length: 13 }).map((_, i) => ({
  id: `srv_${i}`,
  name: `Server ${i + 1}`,
  shardIndex: i,
  status: i % 3 === 0 ? 'healthy' : 'degraded',
  toolCount: 15 + i,
  tokenUsage: 4000 + i * 100,
  tokenBudget: 8000,
  endpoint: `http://localhost:${8080 + i}`,
  port: 8080 + i,
  createdAt: new Date().toISOString()
}));

export const handlers = [
  // ── Auth ──────────────────────────────────
  http.post('/api/auth/login', async () => {
    await delay(ARTIFICIAL_DELAY);
    const response: ApiResponse<LoginResponse> = {
      code: 0,
      message: 'ok',
      data: {
        token: 'mock-jwt-token-xyz',
        user: mockUser
      }
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/auth/me', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: mockUser
    } as ApiResponse<User>);
  }),

  // ── Generator ─────────────────────────────
  http.get('/api/generator/projects', async () => {
    await delay(ARTIFICIAL_DELAY);
    const response: ApiResponse<PaginatedList<Project>> = {
      code: 0,
      message: 'ok',
      data: {
        items: mockProjects,
        total: mockProjects.length,
        page: 1,
        pageSize: 20
      }
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/generator/projects/:id', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    const project = mockProjects.find(p => p.id === params.id) || mockProjects[0];
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
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString()
        }
      ],
      artifacts: []
    };
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: detail
    } as ApiResponse<ProjectDetail>);
  }),

  http.post('/api/generator/projects', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: mockProjects[0]
    } as ApiResponse<Project>);
  }),

  http.post('/api/generator/projects/:id/start', async ({ params }) => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        id: 'r_new',
        projectId: params.id as string,
        status: 'queued',
        parserModel: 'claude-3-haiku',
        coderModel: 'claude-3-5-sonnet',
        fixRounds: 0,
        startedAt: new Date().toISOString()
      }
    } as ApiResponse<GenerateRun>);
  }),

  // SSE Mock
  http.get('/api/generator/projects/:id/events', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => controller.enqueue(encoder.encode(data));
        
        let step = 0;
        const maxSteps = 10;
        
        while (step < maxSteps) {
          step++;
          await new Promise(r => setTimeout(r, 1000));
          
          const log: SseLogEvent = {
            type: 'log',
            level: 'info',
            message: `Step ${step}: Processing...`,
            timestamp: new Date().toISOString()
          };
          send(`event: log\ndata: ${JSON.stringify(log)}\n\n`);

          const progress: SseProgressEvent = {
            type: 'progress',
            percent: step * 10,
            stage: step < 3 ? 'parsing' : 'generating'
          };
          send(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);
        }

        const done: SseDoneEvent = {
          type: 'done',
          projectId: 'p_001',
          artifactCount: 3
        };
        send(`event: done\ndata: ${JSON.stringify(done)}\n\n`);
        controller.close();
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // ── Runtime ──────────────────────────────
  http.get('/api/runtime/servers', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: mockServers
    } as ApiResponse<McpServer[]>);
  }),

  // ── Deploy ──────────────────────────────
  http.post('/api/deploy/preview', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        composeYaml: 'version: "3.8"\nservices:\n  mcp-server-1:\n    image: mcp/server...',
        nginxConf: 'server { listen 80; ... }',
        servers: [
          { serverId: 's1', name: 'ERP Server', port: 8081, toolCount: 12 }
        ]
      }
    } as ApiResponse<DeployPreview>);
  }),

  http.post('/api/deploy/execute', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        id: 'task_deploy_001',
        status: 'pending',
        serverIds: ['s1'],
        startedAt: new Date().toISOString()
      }
    } as ApiResponse<DeployTask>);
  }),

  // ── Admin ────────────────────────────────
  http.get('/api/admin/tenants', async () => {
    await delay(ARTIFICIAL_DELAY);
    const tenants: Tenant[] = [
      { id: 't1', name: 'Acme Corp', contact: 'admin@acme.com', status: 'active', createdAt: new Date().toISOString() }
    ];
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: tenants
    } as ApiResponse<Tenant[]>);
  }),

  http.get('/api/admin/tenants/:id/keys', async () => {
    await delay(ARTIFICIAL_DELAY);
    const keys: ApiKey[] = [
      { id: 'k1', name: 'Dev Key', prefix: 'sk-mcp-dev', expiresAt: new Date(Date.now() + 86400000).toISOString(), status: 'active' }
    ];
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: keys
    } as ApiResponse<ApiKey[]>);
  }),

  // ── Monitor ──────────────────────────────
  http.get('/api/monitor/metrics', async () => {
    await delay(ARTIFICIAL_DELAY);
    return HttpResponse.json({
      code: 0,
      message: 'ok',
      data: {
        summary: { totalServers: 13, activeServers: 10, totalTools: 182, totalRequests: 50000 },
        qps: Array.from({ length: 24 }).map((_, i) => ({ timestamp: new Date().toISOString(), value: Math.random() * 100 })),
        latency: [],
        memory: []
      }
    } as ApiResponse<Metrics>);
  })
];
