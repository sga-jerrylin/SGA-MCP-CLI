# Phase 3-6 实现计划概要

> **注意:** 本文档是 Phase 3-6 的精简版，包含关键任务和负责人分配。如需某个 Phase 的详细版本（类似 Phase 0-2），请告知。

---

## Phase 3: 配置仓库 + 打包 + 云端管理后台（第 4 周）

**目标:** 配置包可打包、签名、上传到云端仓库，云端管理后台可管理租户和 API Key

### 后端任务（Codex）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 3.1 配置包打包 | `packages/backend/src/packages/package.service.ts` | tar.gz 压缩，manifest.json 生成，SHA-256 哈希 |
| 3.2 RSA 签名 | `packages/backend/src/packages/signing.service.ts` | 私钥签名，生成 .sig 文件，SBOM 扫描 |
| 3.3 配置仓库 API | `packages/backend/src/repository/repository.module.ts` | POST /packages/publish, GET /packages, GET /packages/:id/download |
| 3.4 签名验证 | `packages/backend/src/repository/verify.service.ts` | 公钥验证，发布者白名单检查 |
| 3.5 租户管理 API | `packages/backend/src/tenants/tenants.module.ts` | CRUD 租户，生成/吊销 API Key（哈希存储） |
| 3.6 Cloud Docker Compose | `docker-compose.cloud.yml` | Nginx + Hub API + PostgreSQL + Redis + MinIO |

**验收:**
- 上传配置包 → 签名验证通过 → 存储到 MinIO
- 下载配置包 → 签名验证 → 解压缩
- 生成 Tenant API Key → 哈希存储 → 可调用 API

---

### 前端任务（Gemini）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 3.7 配置仓库浏览页面 | `packages/frontend/src/views/Repository/Index.vue` | 包列表（卡片+筛选），包详情，版本历史 |
| 3.8 上传界面 | `packages/frontend/src/views/Repository/Upload.vue` | 拖拽上传 tar.gz，显示上传进度 |
| 3.9 云端管理后台 | `packages/frontend/src/views/Admin/Index.vue` | 仪表盘（租户数/包数/存储用量） |
| 3.10 租户管理页面 | `packages/frontend/src/views/Admin/Tenants.vue` | 租户列表，创建/禁用租户 |
| 3.11 API Key 管理 | `packages/frontend/src/views/Admin/APIKeys.vue` | 生成 Key（一次性显示），吊销，调用统计图表 |
| 3.12 系统设置页面 | `packages/frontend/src/views/Settings/Index.vue` | 基础/AI模型/MCP传输/Docker/安全（Tab切换） |

**验收:**
- 云端管理后台 `/admin` 可登录
- 创建租户 → 生成 API Key → 复制 Key（仅显示一次）
- 上传配置包 → 列表中显示 → 下载验证

---

## Phase 4: MCP Runtime（多 Server 集群）（第 5 周）

**目标:** 13 个独立 MCP Server 可运行，目录服务可发现，自动生成 docker-compose.yml

### 后端任务（Codex）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 4.1 MCP Server 核心 | `packages/mcp-server/src/server.ts` | MCP 协议实现（tools/list, tools/call） |
| 4.2 Connector 动态加载 | `packages/mcp-server/src/loader.ts` | 根据 config.json 加载 Connector 代码 |
| 4.3 连接池 + 限流器 | `packages/mcp-server/src/middleware/rate-limiter.ts` | 令牌桶算法，per-tool QPS 控制 |
| 4.4 熔断器 | `packages/mcp-server/src/middleware/circuit-breaker.ts` | 失败率阈值熔断（连续 5 次 → 熔断 30s） |
| 4.5 Token 预算检查 | `packages/backend/src/servers/token-budget.service.ts` | 序列化 tools/list → tiktoken 计算 → 超 8000 告警 |
| 4.6 Server Registry | `packages/backend/src/servers/registry.module.ts` | GET /api/servers，健康检查调度（30s 轮询） |
| 4.7 Deploy Orchestrator | `packages/backend/src/deploy/orchestrator.service.ts` | 根据启用的 Server 生成 docker-compose.yml |
| 4.8 TLS + API Key 认证 | `nginx/mcp-servers.conf` | Nginx 反向代理，Bearer Token 验证中间件 |
| 4.9 Docker 镜像 | `packages/mcp-server/Dockerfile` | 多阶段构建，共享镜像，挂载不同配置 |

**验收:**
- 生成 docker-compose.yml（13 个 Server）
- `docker-compose up -d` 启动所有 Server
- 所有 Server 健康检查通过
- `curl https://localhost:8090/mcp/tools/list` 返回工具列表（≤8000 token）
- Token 预算检查：所有 Server 未超阈值

---

### 前端任务（Gemini）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 4.10 Server 目录页面 | `packages/frontend/src/views/Servers/Index.vue` | 13 个 Server 卡片网格（健康徽章+工具数+端口） |
| 4.11 Server 详情 Drawer | `packages/frontend/src/views/Servers/DetailDrawer.vue` | 工具列表，Schema 查看器，健康指标 |
| 4.12 部署发布页面 | `packages/frontend/src/views/Deploy/Index.vue` | Transfer 选择启用的 Server |
| 4.13 docker-compose 预览 | `packages/frontend/src/views/Deploy/ComposePreview.vue` | Monaco Editor（YAML 高亮），Token 使用率进度条 |
| 4.14 一键部署 | `packages/frontend/src/views/Deploy/DeployButton.vue` | SSE 实时日志流（docker pull/up 日志） |
| 4.15 系统概览拓扑图 | `packages/frontend/src/views/Dashboard/Topology.vue` | AntV G6（Hub 中心 + 13 Server 节点），点击查看详情 |
| 4.16 工具库页面（虚拟滚动）| `packages/frontend/src/views/Tools/Index.vue` | a-virtual-list 渲染 182 Tool，分类筛选+搜索 |

**验收:**
- 部署发布页面：选择 Server → 预览 Compose → 点击部署 → 实时日志
- 系统概览：拓扑图显示 13 个节点，健康状态实时更新
- 工具库：虚拟滚动流畅，搜索/筛选工作正常

---

## Phase 5: Hub 基础设施（第 6 周）

**目标:** GPU 调度、异步队列、文件存储、审计日志、Prometheus 监控

### 后端任务（Codex）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 5.1 GPU Scheduler | `packages/backend/src/gpu/scheduler.service.ts` | nvidia-smi 检测，任务队列，CUDA_VISIBLE_DEVICES 分配 |
| 5.2 Async Task Queue | `packages/backend/src/tasks/task.module.ts` | BullMQ（视频生成/批量导入），Worker 进程 |
| 5.3 File Storage | `packages/backend/src/storage/storage.service.ts` | MinIO 对接，租户隔离（独立 Bucket），签名 URL |
| 5.4 审计日志 | `packages/backend/src/audit/audit.module.ts` | 记录敏感操作，脱敏（正则替换），查询 API |
| 5.5 Prometheus Metrics | `packages/backend/src/metrics/metrics.service.ts` | 自定义指标（请求数/延迟/Token 使用量） |

**验收:**
- GPU 调度：提交 GPU 任务 → 排队 → 执行（CUDA 设备正确分配）
- 异步队列：提交视频生成任务 → Worker 处理 → 状态查询
- 审计日志：调用敏感 API → 日志记录 → 脱敏检查
- Prometheus：`curl localhost:9090/metrics` 返回指标

---

### 前端任务（Gemini）

| 任务 | 文件 | 关键功能 |
|------|------|---------|
| 5.6 运行监控页面 | `packages/frontend/src/views/Monitoring/Index.vue` | Server 健康卡片，重启按钮，调用统计图表（ECharts） |
| 5.7 审计日志页面 | `packages/frontend/src/views/Audit/Index.vue` | 虚拟滚动表格，高级筛选（时间/租户/操作类型） |
| 5.8 任务管理页面 | `packages/frontend/src/views/Tasks/Index.vue` | 异步任务列表，状态标签，取消/重试按钮 |

**验收:**
- 运行监控：实时图表更新（SSE），重启 Server 功能
- 审计日志：筛选工作，详情显示脱敏

---

## Phase 6: 集成测试 + 上线（第 7-8 周）

**目标:** 所有测试通过，文档完整，生产就绪

### 全员任务

| 任务 | 负责人 | 关键内容 |
|------|--------|---------|
| 6.1 端到端测试 | Claude + Codex | Playwright 自动化（上传文档→生成→部署→调用→审计） |
| 6.2 性能测试 | Codex | 生成引擎压测（10 并发），MCP Server 压测（100 并发） |
| 6.3 Token 预算验证 | Codex | 所有 Server 的 tools/list ≤ 8000 token |
| 6.4 安全测试 | Codex | 凭证泄露检查，SQL 注入/XSS，沙箱逃逸测试 |
| 6.5 TLS 证书验证 | Codex | mTLS 配置，证书轮换测试 |
| 6.6 API 文档 | Claude | OpenAPI 规范完善，Swagger UI 部署 |
| 6.7 用户手册 | Gemini | 如何生成 MCP，如何部署，常见问题 |
| 6.8 运维手册 | Codex | TLS 轮换，主密钥轮换，备份恢复 |
| 6.9 Bug 修复 | All | 根据测试结果修复 |
| 6.10 性能优化 | Codex | 慢查询优化，内存泄漏检查 |

**验收标准:**

- [x] 所有单元测试通过（覆盖率 ≥ 80%）
- [x] 端到端测试通过（核心流程无阻塞）
- [x] 性能测试通过（生成 10 并发 / MCP Server 100 并发）
- [x] 安全测试通过（无高危漏洞）
- [x] Token 预算检查通过（所有 Server ≤ 8000 token）
- [x] 文档完整（API 文档 + 用户手册 + 运维手册）
- [x] Docker Compose 一键启动（Cloud + Local）

**最终产出:**

```
E:\mcp\
├── packages/
│   ├── backend/              # NestJS 后端（完整）
│   ├── frontend/             # Vue3 前端（完整）
│   ├── mcp-server/           # MCP Server 镜像（完整）
│   └── sandbox-worker/       # 沙箱 Worker（完整）
├── docs/
│   ├── api/                  # OpenAPI 规范
│   ├── user-guide.md         # 用户手册
│   └── ops-guide.md          # 运维手册
├── docker-compose.cloud.yml  # 云端部署
├── docker-compose.local.yml  # 客户本地部署（自动生成）
├── scripts/
│   ├── deploy-cloud.sh       # 云端部署脚本
│   └── deploy-local.sh       # 本地部署脚本
└── README.md
```

**部署验证:**

```bash
# 云端部署
./scripts/deploy-cloud.sh
# 访问: https://mcp-hub.company.com/admin

# 本地部署（客户侧）
./scripts/deploy-local.sh
# 1. 选择启用的 Server（13 个中选择 N 个）
# 2. 填入各系统的鉴权信息
# 3. 一键部署
# 4. 验证：curl https://localhost:8090/mcp/tools/list
```

---

## 关键里程碑汇总

| 周 | Phase | 里程碑 | Codex 任务数 | Gemini 任务数 |
|----|-------|--------|-------------|--------------|
| 0 | Phase 0 | 项目初始化 | 3 | 0 |
| 1 | Phase 1 | 骨架搭建 | 4 | 3 |
| 2-3 | Phase 2 | AI 引擎 + 安全 | 8 | 3 |
| 4 | Phase 3 | 配置仓库 + 云端管理 | 6 | 6 |
| 5 | Phase 4 | MCP Runtime 集群 | 9 | 7 |
| 6 | Phase 5 | 基础设施 | 5 | 3 |
| 7-8 | Phase 6 | 测试上线 | 5 | 3 |
| **总计** | — | — | **40 个任务** | **25 个任务** |

---

## Agent 工作量统计

**Codex（后端）:** 40 个主要任务
- Phase 2 最重（8 个复杂任务，包括 AI 引擎核心）
- Phase 4 次重（9 个任务，包括 13 个 Server 集群）

**Gemini（前端）:** 25 个主要任务
- Phase 4 最重（7 个页面，包括拓扑图和虚拟滚动）
- Phase 3 次重（6 个页面，包括云端管理后台）

**Claude（架构师）:** 协调全程
- Phase 0: 定义接口契约、数据库 Schema
- Phase 1-6: Code Review，Git 管理
- Phase 6: 文档审查，部署验证

---

## 执行建议

### 并行策略

**Phase 0-1:** Claude 主导，Codex/Gemini 并行
**Phase 2:** Codex 串行（有依赖），Gemini 并行开发前端
**Phase 3-5:** Codex/Gemini 完全并行，Claude 定期 Review
**Phase 6:** 全员协作

### Review 节点

| Phase | Review 时机 | 审查重点 |
|-------|------------|---------|
| 0 | 初始化完成后 | 项目结构、接口契约 |
| 1 | 骨架完成后 | 前后端可运行性，Auth Vault 单元测试 |
| 2 | AI 引擎完成后 | 代码生成质量，沙箱安全性 |
| 3 | 配置仓库完成后 | 签名验证，云端管理后台 |
| 4 | Runtime 完成后 | Token 预算检查，13 Server 集群 |
| 5 | 基础设施完成后 | 监控/审计/队列 |
| 6 | 每个测试完成后 | 测试覆盖率，性能指标 |

---

## 风险应对总结

| 风险 | 应对策略 | 负责人 |
|------|---------|--------|
| AI 生成质量不稳定 | Phase 2 完善 Prompt + 自动修复循环 | Codex |
| 一人开发进度压力 | Phase 5-6 功能可裁剪（见主计划） | Claude |
| 并发性能瓶颈 | Phase 6 性能测试发现后优化 | Codex |
| 安全漏洞 | Phase 2 完成安全基础，Phase 6 渗透测试 | Codex |
| Token 预算超限 | Phase 4 自动检查 + 拆分建议 | Codex |

---

## 完整详细计划索引

**已创建:**
- ✅ 主计划: `2026-02-16-mcp-hub-implementation-plan.md`
- ✅ Phase 0: `2026-02-16-phase-0-setup.md`（详细，TDD）
- ✅ Phase 1: `2026-02-16-phase-1-skeleton.md`（详细，TDD）
- ✅ Phase 2: `2026-02-16-phase-2-ai-engine.md`（详细，TDD）
- ✅ Phase 3-6: `2026-02-16-phase-3-6-summary.md`（本文档，精简版）

**待创建（如需）:**
- Phase 3 详细版（TDD 风格，每个任务 5-10 步骤）
- Phase 4 详细版（TDD 风格，每个任务 5-10 步骤）
- Phase 5 详细版（TDD 风格，每个任务 5-10 步骤）
- Phase 6 详细版（测试用例列表，验收脚本）

**生成详细计划命令:**
> 如需某个 Phase 的完整详细计划，请告知 Claude："生成 Phase X 的详细计划（TDD 风格）"
