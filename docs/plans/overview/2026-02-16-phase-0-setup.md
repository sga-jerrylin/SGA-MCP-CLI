# Phase 0: 准备工作 — 详细计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 初始化项目仓库、配置开发环境、定义前后端接口契约

**时间:** 2-3 天

**负责人:** Claude（架构师）协调，各 agent 并行执行

---

## Task 0.1: Monorepo 初始化

**负责人:** Claude

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: 初始化 Monorepo 根目录**

```bash
cd E:\mcp
pnpm init
```

**Step 2: 配置 pnpm workspace**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

**Step 3: 创建 TypeScript 基础配置**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@mcp-hub/*": ["packages/*/src"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

**Step 4: 配置 .gitignore**

```
# .gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.pnpm-debug.log
secrets/
*.key
*.pem
```

**Step 5: 创建 README**

```markdown
# MCP Hub

智能 MCP 生成工作台 + 企业工具运行时 + 配置仓库

## 架构

- 前端: Vue3 + TypeScript + Ant Design Vue
- 后端: NestJS + PostgreSQL + Redis + MinIO
- Runtime: 13 个独立 MCP Server

## 快速开始

\`\`\`bash
# 安装依赖
pnpm install

# 启动开发环境
docker-compose -f docker-compose.dev.yml up -d
pnpm dev

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:3000
\`\`\`

## 文档

- [设计文档](./docs/plans/2026-02-15-mcp-hub-design.md)
- [实现计划](./docs/plans/2026-02-16-mcp-hub-implementation-plan.md)
```

**Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: 初始化 monorepo 项目结构"
```

---

## Task 0.2: 创建 Package 目录结构

**负责人:** Claude

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/frontend/package.json`
- Create: `packages/mcp-server/package.json`
- Create: `packages/sandbox-worker/package.json`

**Step 1: 创建 backend package**

```bash
mkdir -p packages/backend/src
cd packages/backend
pnpm init
```

```json
// packages/backend/package.json
{
  "name": "@mcp-hub/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/typeorm": "^10.0.1",
    "typeorm": "^0.3.19",
    "pg": "^8.11.3",
    "redis": "^4.6.11",
    "bullmq": "^5.1.0",
    "minio": "^7.1.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "jest": "^29.7.0"
  }
}
```

**Step 2: 创建 frontend package**

```bash
mkdir -p packages/frontend
cd packages/frontend
pnpm create vite . --template vue-ts
```

修改 `package.json`:

```json
{
  "name": "@mcp-hub/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.15",
    "vue-router": "^4.2.5",
    "pinia": "^2.1.7",
    "ant-design-vue": "^4.1.1",
    "@antv/g6": "^4.8.24",
    "monaco-editor": "^0.45.0",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.3",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "vue-tsc": "^1.8.27"
  }
}
```

**Step 3: 创建 mcp-server package**

```bash
mkdir -p packages/mcp-server/src
cd packages/mcp-server
pnpm init
```

```json
{
  "name": "@mcp-hub/mcp-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.18.2",
    "zod": "^3.22.4"
  }
}
```

**Step 4: 创建 sandbox-worker package**

```bash
mkdir -p packages/sandbox-worker/src
cd packages/sandbox-worker
pnpm init
```

```json
{
  "name": "@mcp-hub/sandbox-worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc",
    "start": "node dist/worker.js"
  },
  "dependencies": {
    "bullmq": "^5.1.0",
    "openapi-mcp-generator": "^0.1.0",
    "tsx": "^4.7.0"
  }
}
```

**Step 5: 安装所有依赖**

```bash
cd ../..
pnpm install
```

**Step 6: Commit**

```bash
git add packages/
git commit -m "chore: 创建 4 个 package (backend/frontend/mcp-server/sandbox-worker)"
```

---

## Task 0.3: Docker Compose 开发环境

**负责人:** Claude

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `scripts/setup.sh`

**Step 1: 创建 docker-compose.dev.yml**

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: mcp_hub
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: mcp_hub_dev
    volumes:
      - pg-dev-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_hub"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-dev-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: mcp_hub_admin
      MINIO_ROOT_PASSWORD: dev_password
    command: server /data --console-address ":9001"
    volumes:
      - minio-dev-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  pg-dev-data:
  redis-dev-data:
  minio-dev-data:
```

**Step 2: 创建 setup.sh 脚本**

```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🚀 MCP Hub 开发环境初始化"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，正在安装..."
    npm install -g pnpm
fi

# 启动 Docker 服务
echo "📦 启动 PostgreSQL, Redis, MinIO..."
docker-compose -f docker-compose.dev.yml up -d

# 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 10

# 安装依赖
echo "📥 安装 Node.js 依赖..."
pnpm install

# 生成自签名证书（用于 TLS 开发）
echo "🔐 生成开发用 TLS 证书..."
mkdir -p secrets
openssl req -x509 -newkey rsa:4096 -keyout secrets/dev-key.pem -out secrets/dev-cert.pem -days 365 -nodes -subj "/CN=localhost"

echo "✅ 开发环境初始化完成！"
echo ""
echo "下一步:"
echo "  pnpm dev           # 启动所有服务"
echo "  http://localhost:5173   # 前端"
echo "  http://localhost:3000   # 后端"
```

```bash
chmod +x scripts/setup.sh
```

**Step 3: 运行初始化脚本**

```bash
./scripts/setup.sh
```

**Expected output:**
```
✅ 开发环境初始化完成！
```

**Step 4: Commit**

```bash
git add docker-compose.dev.yml scripts/
git commit -m "chore: 添加 Docker Compose 开发环境配置"
```

---

## Task 0.4: 定义前后端接口契约（OpenAPI）

**负责人:** Claude

**Files:**
- Create: `docs/api/openapi.yaml`

**Step 1: 创建 OpenAPI 规范文件**

```yaml
# docs/api/openapi.yaml
openapi: 3.0.3
info:
  title: MCP Hub API
  version: 1.0.0
  description: MCP Hub 后端 API 规范

servers:
  - url: http://localhost:3000
    description: 开发环境

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

    # Server Registry
    MCPServer:
      type: object
      required:
        - id
        - name
        - endpoint
        - status
        - toolCount
      properties:
        id:
          type: string
          example: "wecom-msg"
        name:
          type: string
          example: "企业微信消息"
        endpoint:
          type: string
          format: uri
          example: "http://localhost:8090/mcp"
        transport:
          type: string
          enum: [streamable-http, stdio]
        toolCount:
          type: integer
          example: 11
        status:
          type: string
          enum: [healthy, unhealthy, starting]
        category:
          type: string
          example: "企业微信"
        tags:
          type: array
          items:
            type: string

    # Generator
    GeneratorProject:
      type: object
      required:
        - id
        - name
        - status
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          example: "企业微信消息"
        systemCode:
          type: string
          example: "sga_phone"
        status:
          type: string
          enum: [pending, generating, testing, completed, failed]
        toolsGenerated:
          type: integer
        toolsTotal:
          type: integer
        createdAt:
          type: string
          format: date-time

paths:
  # Health Check
  /health:
    get:
      summary: 健康检查
      responses:
        '200':
          description: 服务正常
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok

  # Server Registry
  /api/servers:
    get:
      summary: 获取所有 MCP Server
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Server 列表
          content:
            application/json:
              schema:
                type: object
                properties:
                  servers:
                    type: array
                    items:
                      $ref: '#/components/schemas/MCPServer'

  /api/servers/{id}:
    get:
      summary: 获取 Server 详情
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Server 详情
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MCPServer'

  # Generator
  /api/generator/projects:
    post:
      summary: 创建生成项目
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - systemCode
              properties:
                name:
                  type: string
                systemCode:
                  type: string
                category:
                  type: string
      responses:
        '201':
          description: 项目创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GeneratorProject'

  /api/generator/projects/{id}/generate:
    post:
      summary: 开始生成
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 生成任务已提交
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobId:
                    type: string
                    format: uuid
```

**Step 2: Commit**

```bash
git add docs/api/
git commit -m "docs: 添加前后端接口契约 (OpenAPI 规范)"
```

---

## Task 0.5: 数据库 Schema 设计

**负责人:** Claude

**Files:**
- Create: `packages/backend/src/database/migrations/001_initial_schema.sql`

**Step 1: 创建初始 Schema**

```sql
-- packages/backend/src/database/migrations/001_initial_schema.sql

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 租户表
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 凭证表（Auth Vault）
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_id VARCHAR(50) NOT NULL,
  key_name VARCHAR(100) NOT NULL,

  -- 加密字段
  encrypted_value BYTEA NOT NULL,
  encryption_iv BYTEA NOT NULL CHECK(octet_length(encryption_iv) = 12),
  auth_tag BYTEA NOT NULL CHECK(octet_length(auth_tag) = 16),
  key_version INT NOT NULL,

  -- 元数据
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,

  UNIQUE(tenant_id, server_id, key_name)
);

CREATE INDEX idx_credentials_tenant ON credentials(tenant_id);
CREATE INDEX idx_credentials_server ON credentials(server_id);

-- 启用行级安全
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_credentials ON credentials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- MCP Server 表
CREATE TABLE mcp_servers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  transport VARCHAR(20) NOT NULL DEFAULT 'streamable-http',
  category VARCHAR(50),
  tool_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'starting',
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 工具配置表
CREATE TABLE tool_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_id VARCHAR(50) NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  input_schema JSONB NOT NULL,
  output_schema JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(server_id, tool_name)
);

CREATE INDEX idx_tool_configs_server ON tool_configs(server_id);
CREATE INDEX idx_tool_configs_tenant ON tool_configs(tenant_id);

ALTER TABLE tool_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tools ON tool_configs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- 生成项目表
CREATE TABLE generator_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  system_code VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tools_generated INT NOT NULL DEFAULT 0,
  tools_total INT NOT NULL DEFAULT 0,
  artifact_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generator_projects_tenant ON generator_projects(tenant_id);

ALTER TABLE generator_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_projects ON generator_projects
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- 审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  user_id VARCHAR(100),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 审计日志不强制租户隔离（管理员需要看所有日志）

-- API Key 表
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(100),
  scopes TEXT[], -- ['read', 'write', 'admin']
  quota_per_minute INT NOT NULL DEFAULT 100,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- 初始化默认租户（开发用）
INSERT INTO tenants (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'active');
```

**Step 2: 运行 Migration**

```bash
cd packages/backend
docker exec -i mcp-hub-postgres-1 psql -U mcp_hub -d mcp_hub_dev < src/database/migrations/001_initial_schema.sql
```

**Expected output:**
```
CREATE EXTENSION
CREATE TABLE
CREATE TABLE
...
INSERT 0 1
```

**Step 3: Commit**

```bash
git add packages/backend/src/database/
git commit -m "feat: 添加数据库 Schema（租户/凭证/Server/工具/审计）"
```

---

## Phase 0 验收标准

- [x] Monorepo 结构创建完成
- [x] 4 个 package 目录就绪
- [x] Docker Compose 开发环境可运行
- [x] PostgreSQL/Redis/MinIO 健康检查通过
- [x] 数据库 Schema 创建完成
- [x] OpenAPI 接口契约定义完成
- [x] TLS 开发证书生成完成

**验证命令:**

```bash
# 检查 Docker 服务
docker ps

# 检查 PostgreSQL
docker exec mcp-hub-postgres-1 psql -U mcp_hub -d mcp_hub_dev -c "\dt"

# 检查依赖安装
pnpm list --depth=0
```

**预期输出:**
- 3 个 Docker 容器运行中（postgres/redis/minio）
- 数据库表列表显示 8 个表
- 所有 package 依赖安装成功

---

## 下一步

Phase 0 完成后，进入 **Phase 1: 骨架搭建**

**Phase 1 目标:**
- 后端: NestJS 项目可运行，基础模块创建
- 前端: Vue3 项目可运行，布局框架完成
- 认证: JWT 登录/登出功能

**预计时间:** 1 周
