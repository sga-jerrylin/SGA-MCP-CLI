# Mock Server Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 基于 `api-contract.yaml` 和 `@mcp-claw/shared` 类型，实现前端开发用的 Mock Server。

---

### Task 1: 初始化 Mock Server 项目

**Files:**
- Create: `packages/mock-server/package.json`
- Create: `packages/mock-server/tsconfig.json`
- Create: `packages/mock-server/src/index.ts`

**代码实现:**
```json
{
  "name": "@mcp-claw/mock-server",
  "version": "0.1.0",
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "nodemon src/index.ts"
  },
  "dependencies": {
    "@mcp-claw/shared": "workspace:*",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.1",
    "typescript": "^5.2.2"
  }
}
```

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { setupRoutes } from './routes';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

setupRoutes(app);

app.listen(PORT, () => {
  console.log(`Mock Server running at http://localhost:${PORT}`);
});
```

---

### Task 2: Auth Mock (/auth)

**Files:**
- Create: `packages/mock-server/src/routes/auth.ts`

**代码实现:**
```typescript
import { Router } from 'express';
import type { ApiResponse, LoginResponse, User } from '@mcp-claw/shared';

export const authRouter = Router();

const mockUser: User = {
  id: 'u_001',
  username: 'admin',
  role: 'admin',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  tenantId: 't_001'
};

authRouter.post('/login', (req, res) => {
  const response: ApiResponse<LoginResponse> = {
    code: 0,
    message: 'ok',
    data: {
      token: 'mock-jwt-token-xyz',
      user: mockUser
    }
  };
  res.json(response);
});

authRouter.get('/me', (req, res) => {
  const response: ApiResponse<User> = {
    code: 0,
    message: 'ok',
    data: mockUser
  };
  res.json(response);
});
```

---

### Task 3: Generator Projects Mock (/generator/projects)

**Files:**
- Create: `packages/mock-server/src/routes/generator.ts`

**代码实现:**
```typescript
import { Router } from 'express';
import type { ApiResponse, PaginatedList, Project, ProjectDetail } from '@mcp-claw/shared';

export const generatorRouter = Router();

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

generatorRouter.get('/projects', (req, res) => {
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
  res.json(response);
});

generatorRouter.get('/projects/:id', (req, res) => {
  const project = mockProjects.find(p => p.id === req.params.id) || mockProjects[0];
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

  const response: ApiResponse<ProjectDetail> = {
    code: 0,
    message: 'ok',
    data: detail
  };
  res.json(response);
});
```

---

### Task 4: SSE Events Mock (/generator/projects/:id/events)

**Files:**
- Modify: `packages/mock-server/src/routes/generator.ts`

**代码实现:**
```typescript
// 添加 SSE 路由
generatorRouter.get('/projects/:id/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}
`);
    res.write(`data: ${JSON.stringify(data)}

`);
  };

  // 模拟生成流程
  let step = 0;
  const interval = setInterval(() => {
    step++;
    
    // Log
    sendEvent('log', {
      type: 'log',
      level: 'info',
      message: `正在执行步骤 ${step}...`,
      timestamp: new Date().toISOString()
    });

    // Progress
    sendEvent('progress', {
      type: 'progress',
      percent: step * 10,
      stage: step < 3 ? 'parsing' : 'generating'
    });

    if (step >= 10) {
      clearInterval(interval);
      sendEvent('done', {
        type: 'done',
        projectId: req.params.id,
        artifactCount: 3
      });
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});
```

---

### Task 5: Runtime Servers Mock (/runtime/servers)

**Files:**
- Create: `packages/mock-server/src/routes/runtime.ts`

**代码实现:**
```typescript
import { Router } from 'express';
import type { ApiResponse, McpServer, McpServerDetail } from '@mcp-claw/shared';

export const runtimeRouter = Router();

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

runtimeRouter.get('/servers', (req, res) => {
  const response: ApiResponse<McpServer[]> = {
    code: 0,
    message: 'ok',
    data: mockServers
  };
  res.json(response);
});
```

---

### Task 6: Deploy Preview & Execute Mock (/deploy)

**Files:**
- Create: `packages/mock-server/src/routes/deploy.ts`

**代码实现:**
```typescript
import { Router } from 'express';
import type { ApiResponse, DeployPreview, DeployTask } from '@mcp-claw/shared';

export const deployRouter = Router();

deployRouter.post('/preview', (req, res) => {
  const response: ApiResponse<DeployPreview> = {
    code: 0,
    message: 'ok',
    data: {
      composeYaml: 'version: "3.8"
services:
  mcp-server-1:
    image: mcp/server...',
      nginxConf: 'server { listen 80; ... }',
      servers: [
        { serverId: 's1', name: 'ERP Server', port: 8081, toolCount: 12 }
      ]
    }
  };
  res.json(response);
});

deployRouter.post('/execute', (req, res) => {
  const response: ApiResponse<DeployTask> = {
    code: 0,
    message: 'ok',
    data: {
      id: 'task_deploy_001',
      status: 'pending',
      serverIds: ['s1'],
      startedAt: new Date().toISOString()
    }
  };
  res.status(202).json(response);
});
```

---

### Task 7: Repo & Admin Mock

**Files:**
- Create: `packages/mock-server/src/routes/repo.ts`
- Create: `packages/mock-server/src/routes/admin.ts`

**代码实现:**
```typescript
// Repo (略，结构同 Generator)
// Admin
import { Router } from 'express';
import type { ApiResponse, Tenant, ApiKey } from '@mcp-claw/shared';

export const adminRouter = Router();

adminRouter.get('/tenants', (req, res) => {
  const response: ApiResponse<Tenant[]> = {
    code: 0,
    message: 'ok',
    data: [
      { id: 't1', name: 'Acme Corp', contact: 'admin@acme.com', status: 'active', createdAt: new Date().toISOString() }
    ]
  };
  res.json(response);
});
```

---

### Task 8: Monitor Mock

**Files:**
- Create: `packages/mock-server/src/routes/monitor.ts`

**代码实现:**
```typescript
import { Router } from 'express';
import type { ApiResponse, Metrics } from '@mcp-claw/shared';

export const monitorRouter = Router();

monitorRouter.get('/metrics', (req, res) => {
  const response: ApiResponse<Metrics> = {
    code: 0,
    message: 'ok',
    data: {
      summary: { totalServers: 13, activeServers: 10, totalTools: 182, totalRequests: 50000 },
      qps: Array.from({ length: 24 }).map((_, i) => ({ timestamp: new Date().toISOString(), value: Math.random() * 100 })),
      latency: [],
      memory: []
    }
  };
  res.json(response);
});
```

CCB_DONE: 20260217-013824-681-18268-5
