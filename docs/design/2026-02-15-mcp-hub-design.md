# MCP Hub 产品设计文档

> **版本:** v1.3
> **日期:** 2026-02-16
> **状态:** 设计确认（v1.3 更新：补充所有安全和技术实现细节）
>
> **v1.3 变更摘要（基于 Codex/Gemini 审查建议）：**
> - ✅ Token 预算检查机制（自动计算 tools/list token，超 8000 告警/拆分）
> - ✅ MCP Server 端点认证（TLS + Tenant API Key，Nginx 反向代理）
> - ✅ Auth Vault 加密细节（IV/nonce 随机生成，AAD 绑定上下文，防密文篡改）
> - ✅ 沙箱网络策略（iptables 白名单，分阶段出站控制，禁 Docker socket）
> - ✅ 租户隔离实现（PostgreSQL RLS + MinIO 独立 Bucket）
> - ✅ 配置包签名验证（RSA-SHA256，发布者白名单，SBOM 扫描）

---

## 一、项目定位

### 1.1 一句话定义

**MCP Hub = 智能MCP生成工作台 + 企业工具运行时 + 配置仓库**

它不只是一个运行时平台，而是一个能通过AI自动将API文档转化为可用MCP Server的智能开发与交付一体化平台。

### 1.2 要解决的核心问题

企业对接AI Agent时，每个外部系统都需要手工封装MCP Server。182个Tool，每个都要写Connector代码、处理鉴权、测试调试。一个人做，不可能手写。

**解法：** 上传API文档 → AI全自动生成MCP代码 → 自动测试 → 打包存云端 → 客户现场下载填鉴权即用。

### 1.3 上下游关系

```
用户 / 企业系统事件（微信、钉钉、飞书、Web、API、Webhook）
       │
   ┌───▼───────────────────────────────────────┐
   │             SGA-Molt 平台                   │
   │                                             │
   │   ┌──────────┐      ┌───────────────────┐  │
   │   │  主 Agent  │─────→│  Sub-Agent 1..N   │  │
   │   │  (调度者)  │      │ (各有Soul/Skill)  │  │
   │   └─────┬────┘      └────────┬──────────┘  │
   │         │                     │             │
   │   ┌─────▼─────────────────────▼──────────┐ │
   │   │          Skill（编排层）               │ │
   │   │  "做什么" + "怎么做" 的Prompt工作流     │ │
   │   └──────────────────┬───────────────────┘ │
   │                      │                      │
   │   ┌──────────────────▼───────────────────┐ │
   │   │        ★ MCP Hub（本项目）★            │ │
   │   │  Tool（执行层）= 真正操作外部系统       │ │
   │   │  8大类 / 182个Tool / 统一鉴权+路由     │ │
   │   └──────────────────────────────────────┘ │
   └─────────────────────────────────────────────┘
```

**关键关系：**
- Skill = 编排层，定义"做什么"和"怎么做"
- MCP Tool = 执行层，真正去ERP查表、往CRM写数据、查知识库
- Skill调用MCP Tool完成实际操作，Skill本身不直接执行外部系统操作
- **Claw前端需要先知道所有可用Tool，才能开发Skill** — MCP Hub是咽喉

### 1.4 多上游支持

MCP Hub不仅服务SGA-Molt/Claw，也可作为标准MCP Server供以下平台使用：
- Dify
- HiAgent
- 任何支持MCP协议的AI Agent平台

---

## 二、产品架构

### 2.1 三层合一

```
MCP Hub = 三个层面合一

┌─────────────────────────────────────────────────────────────┐
│                     MCP Hub 产品架构                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           前端（Vue3 + TS + Ant Design Vue）             │ │
│  │                                                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ 开发工作台 │ │ 连接管理  │ │ 工具库    │ │ 部署发布  │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ 配置仓库  │ │ 运行监控  │ │ 审计日志  │ │ 系统设置  │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              后端（NestJS + TypeScript）                  │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  AI 生成引擎（核心模块）                            │  │ │
│  │  │  ├─ 文档解析器                                     │  │ │
│  │  │  ├─ Tool定义生成器                                 │  │ │
│  │  │  ├─ Connector代码生成器                            │  │ │
│  │  │  ├─ 测试用例生成器                                 │  │ │
│  │  │  └─ AI自动修复器                                   │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌────────────┐ ┌──────────┐ ┌───────────────────┐    │ │
│  │  │ Control     │ │ Tool     │ │ Config Repository │    │ │
│  │  │ Plane API   │ │ Registry │ │ （配置仓库）        │    │ │
│  │  └────────────┘ └──────────┘ └───────────────────┘    │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              MCP Runtime（Data Plane）                   │ │
│  │                                                         │ │
│  │  tools/list ← Claw / Dify / HiAgent                    │ │
│  │  tools/call ← Claw / Dify / HiAgent                    │ │
│  │                                                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │ │
│  │  │ Shard 1 │ │ Shard 2 │ │ Shard 3 │ │ Shard N │     │ │
│  │  │ 企微     │ │ ERP    │ │ RAG     │ │ ...     │     │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈（最终决定）

| 层 | 技术 | 理由 |
|---|---|---|
| 前端 | Vue3 + TypeScript + Ant Design Vue + Pinia | React存在CVE安全漏洞，Vue3更稳定 |
| 后端 | NestJS + TypeScript | 模块化强，适合平台型项目 |
| 数据库 | PostgreSQL + JSONB | 关系模型 + schema灵活存储 |
| 缓存 | Redis | 限流、幂等、token缓存 |
| 对象存储 | MinIO | 私有化友好，存文档/产物/归档 |
| MCP底座 | 适配器模式集成 openapi-mcp-generator | 依赖上游版本+最小封装，避免 fork 维护成本 |
| AI模型 | 多模型分层（见3.3） | 成本与质量均衡 |

---

## 三、AI生成引擎（核心模块）

### 3.1 全链路流程

```
输入：标准Markdown接口文档（按模板）或 OpenAPI规范
  │
  ├─ Step 1: 文档解析
  │   ├─ Markdown模板 → 结构化JSON（IR中间表示）
  │   └─ OpenAPI → 同样的IR
  │
  ├─ Step 2: Tool定义生成
  │   ├─ toolName（稳定标识，如 sga_rag.search）
  │   ├─ displayName（中文业务名）
  │   ├─ inputSchema / outputSchema（JSON Schema + Zod）
  │   └─ 示例数据
  │
  ├─ Step 3: Connector代码生成
  │   ├─ 鉴权模块（根据文档中的鉴权方式）
  │   ├─ 请求构造（URL拼接、Header、Body组装）
  │   ├─ 响应解析（字段映射、数据转换）
  │   ├─ 分页处理（自动检测分页模式）
  │   ├─ 错误处理（错误码归一化到6类）
  │   ├─ 确认机制（标记为"需要确认"的自动加）
  │   └─ 异步处理（标记为"异步"的走任务队列）
  │
  ├─ Step 4: 测试用例生成
  │   ├─ 从文档示例自动生成
  │   ├─ Mock测试（不连真实系统，验证代码逻辑）
  │   └─ 集成测试（连真实系统，验证端到端）
  │
  ├─ Step 5: 自动测试 + AI修复循环（最多3轮）
  │   ├─ 运行测试
  │   ├─ 失败 → AI分析错误 → 修改代码 → 重测
  │   └─ 3轮仍失败 → 标记为需人工介入
  │
  └─ Step 6: 打包
      ├─ Connector代码 + Tool定义 + 测试用例 + 映射规则
      ├─ 版本号 + 变更日志 + 兼容性标记
      └─ 可上传到配置仓库
```

### 3.2 沙箱执行环境（安全隔离）

**问题：** Codex 审查指出生成的代码不能在主 API 进程中运行（安全+稳定性风险）。

**解决方案：独立 Worker 容器**

```
AI 生成引擎执行流程：

用户上传文档 → Hub API 创建生成任务
                     ↓
              BullMQ 任务队列
                     ↓
      ┌──────────────────────────────┐
      │    Sandbox Worker (Docker)    │
      │                               │
      │  1. 拉取任务                   │
      │  2. 文档解析（AI）             │
      │  3. 代码生成（AI）             │
      │  4. 编译 TypeScript            │
      │  5. 运行测试（隔离网络）        │
      │  6. AI 修复循环（最多 3 轮）   │
      │  7. 打包上传 MinIO             │
      │                               │
      │  资源限制：                    │
      │  - CPU: 2 核                  │
      │  - 内存: 4GB                  │
      │  - 磁盘: 10GB（临时）          │
      │  - 网络: 仅允许访问 AI API    │
      │  - 超时: 单任务 30 分钟        │
      └──────────────────────────────┘
```

**安全隔离措施：**

| 层级 | 隔离机制 | 实现细节 |
|------|---------|---------|
| 进程 | 独立 Docker 容器，非特权模式 | `--security-opt=no-new-privileges` |
| 网络 | 白名单出站策略（见下） | Docker network + iptables 规则 |
| 文件系统 | tmpfs（内存文件系统） | `--tmpfs /tmp:rw,noexec,nosuid,size=1g` |
| 资源 | cgroups 限制 | `--cpus=2 --memory=4g --pids-limit=100` |
| 超时 | 单任务强制超时 | BullMQ job timeout: 30 分钟 |

#### 网络策略详细定义

**问题：** 沙箱需要访问多个服务（AI Provider + Hub/MinIO），不能简单地"仅允许 AI API"。

**解决方案：分阶段白名单**

```yaml
# docker-compose.yml - Sandbox Worker 网络配置
services:
  sandbox-worker:
    image: mcp-hub/sandbox:latest
    networks:
      - sandbox-net  # 隔离网络
    dns:
      - 8.8.8.8  # 仅允许公网 DNS

networks:
  sandbox-net:
    driver: bridge
    internal: false  # 允许出站
```

**iptables 规则（在 Docker 宿主机配置）：**

```bash
# 默认拒绝所有出站
iptables -A DOCKER-USER -i br-sandbox -j DROP

# 白名单：AI Provider API
iptables -I DOCKER-USER -i br-sandbox -d api.anthropic.com -p tcp --dport 443 -j ACCEPT
iptables -I DOCKER-USER -i br-sandbox -d api.openai.com -p tcp --dport 443 -j ACCEPT
iptables -I DOCKER-USER -i br-sandbox -d generativelanguage.googleapis.com -p tcp --dport 443 -j ACCEPT

# 白名单：Hub API（仅任务状态上报和工件上传）
iptables -I DOCKER-USER -i br-sandbox -d <HUB_API_IP> -p tcp --dport 3000 -j ACCEPT

# 白名单：MinIO（仅上传工件）
iptables -I DOCKER-USER -i br-sandbox -d <MINIO_IP> -p tcp --dport 9000 -j ACCEPT

# 白名单：PostgreSQL/Redis（仅 Worker 需要读取任务）
iptables -I DOCKER-USER -i br-sandbox -d <PG_IP> -p tcp --dport 5432 -j ACCEPT
iptables -I DOCKER-USER -i br-sandbox -d <REDIS_IP> -p tcp --dport 6379 -j ACCEPT

# 集成测试特殊情况（可选，需用户明确授权）
# 临时添加目标系统 IP（任务级动态配置）
# iptables -I DOCKER-USER -i br-sandbox -d <TARGET_SYSTEM_IP> -p tcp --dport <PORT> -j ACCEPT
```

**动态网络策略（集成测试）：**

```typescript
// 用户启用集成测试时，临时添加网络规则
async function runIntegrationTests(job: Job, userAuthorized: boolean) {
  if (!userAuthorized) {
    throw new Error('Integration tests require explicit user authorization');
  }

  const targetSystem = job.data.targetSystem;  // 如 'https://erp.company.com:8443'
  const { hostname, port } = parseUrl(targetSystem);

  // 添加临时防火墙规则（任务结束后自动删除）
  const ruleId = await iptables.allowOutbound(hostname, port, job.id);

  try {
    await executeTests(job);
  } finally {
    await iptables.removeRule(ruleId);  // 任务结束必须清理
  }
}
```

**禁止 Docker Socket 访问：**

```yaml
# ❌ 错误：挂载 Docker socket 会破坏隔离
volumes:
  - /var/run/docker.sock:/var/run/docker.sock  # 绝对禁止

# ✅ 正确：沙箱内完全无 Docker 访问权限
# 如需容器编排，使用外部服务（如 Kubernetes Jobs）
```

**测试执行策略：**

```typescript
// Mock 测试（无需真实系统）
runMockTests(generatedCode) {
  // 在沙箱内执行，验证代码逻辑正确性
  // 使用 nock 等库 mock HTTP 响应
}

// 集成测试（可选，需用户授权）
runIntegrationTests(generatedCode, userCredentials) {
  // 仅在用户明确授权时执行
  // 连接真实系统，验证端到端流程
  // 需要特殊网络策略（允许访问目标系统）
}
```

**工件管理：**
- 生成的代码、测试报告、日志上传 MinIO
- 沙箱容器销毁后无痕迹（防止凭证泄露）
- Hub API 轮询任务状态，实时推送给前端

### 3.3 接口文档模板（标准Markdown格式）

所有自研系统按此模板提供接口文档，AI解析准确率接近100%。

```markdown
# [系统名称] 接口文档

## 系统信息

- 系统代号: <前缀，如 sga_rag>
- 基础URL: <如 http://localhost:9380/api/v1>
- 鉴权方式: <Bearer Token / API Key / HMAC / OAuth2 / 无>
- 鉴权配置:
  - Header: <如 Authorization>
  - 格式: <如 Bearer {token}>
  - Token获取: <描述获取方式>

---

## 接口列表

### <系统代号>.<方法名>

- 中文名: <如 语义检索>
- 描述: <一句话功能描述>
- HTTP方法: <GET/POST/PUT/DELETE>
- 路径: <如 /retrieval/search>
- 需要确认: <是/否，涉及资金或写操作标"是">
- 异步: <是/否，耗时操作标"是">
- 预计耗时: <如 10s-5min，异步时填写>

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|

#### 响应结构

| 字段 | 类型 | 说明 |
|------|------|------|

#### 错误码

| 错误码 | HTTP状态码 | 说明 | 可重试 |
|--------|-----------|------|--------|

#### 示例

请求:（JSON）
响应:（JSON）
```

**模板关键字段到代码的映射：**

| 模板字段 | 生成代码 |
|---------|---------|
| 系统代号 | Tool命名前缀 |
| 鉴权方式 | Connector auth模块 |
| HTTP方法 + 路径 | 请求构造代码 |
| 请求参数表 | inputSchema + Zod验证 |
| 响应结构表 | outputSchema |
| 错误码表 | 错误归一化映射 |
| 需要确认 | 调用前确认机制 |
| 异步 | 任务队列集成 |
| 示例 | 测试用例 |

### 3.4 AI模型策略（全灵活配置）

所有阶段的模型选择完全可配置，以下为推荐默认值：

| 阶段 | 默认推荐 | 理由 | 备选 |
|------|---------|------|------|
| 文档解析（文本） | Claude Haiku | 结构提取，不需强推理 | GPT-4o-mini, DeepSeek |
| 文档解析（PDF/截图） | Gemini Flash | 视觉模型，擅长解析非结构化文档 | Claude Sonnet（视觉）, GPT-4o |
| 代码生成 | Claude Sonnet 4.5 | 代码+推理最均衡 | GPT-4o, DeepSeek Coder |
| 错误修复 | Claude Opus | 需要最强推理看懂复杂错误链 | Claude Sonnet（成本敏感时） |
| 中文命名 | 本地Qwen3 | 翻译任务，不需代码能力 | Haiku, DeepSeek |

**关键设计：每个阶段模型可独立切换，不绑定任何特定Provider。**

支持的文档输入格式扩展：
- Markdown模板（自研系统，AI解析最准确）
- OpenAPI 3.0 JSON/YAML（大厂标准API）
- Postman Collection（已有测试用例的系统）
- **PDF文档**（第三方系统，无标准格式时，使用视觉模型解析）
- **网页截图**（无文档只有UI的系统，使用视觉模型识别）

**AI引擎设置面板支持：**
- 每个阶段独立选择模型和Provider
- 自定义Provider（Anthropic / OpenAI / Google / DeepSeek / 本地Ollama）
- 文档解析阶段可切换为视觉模型处理PDF/截图
- 提示词模板可查看和编辑（高级功能）
- 生成策略配置（最大修复轮次、超时、并行数）
- 模型API Key统一管理，支持测试连通性

---

## 四、配置仓库（Cloud端）

### 4.1 概念

类比Docker Hub：开发调试好的MCP配置包上传到云端，客户部署时下载即用。

### 4.2 配置包内容

每个配置包 = 一个可版本化、可分发的插件包：

```
yonyou-u8-v12.5/
├── manifest.json        # 元信息：名称、版本、兼容性、Tool列表
├── connector/
│   ├── auth.ts          # 鉴权模块
│   ├── client.ts        # HTTP客户端（请求构造、响应解析）
│   ├── errors.ts        # 错误归一化
│   └── pagination.ts    # 分页处理
├── tools/
│   ├── query_voucher.ts       # 各Tool的定义和处理逻辑
│   ├── create_voucher.ts
│   └── ...
├── schemas/
│   ├── input/           # inputSchema (JSON Schema)
│   └── output/          # outputSchema
├── tests/
│   ├── mock/            # Mock测试用例
│   └── integration/     # 集成测试用例
├── mappings.json        # 字段映射规则
└── CHANGELOG.md         # 变更日志
```

### 4.3 配置仓库架构

```
┌────────────────────────────────────────────┐
│           配置仓库（Cloud）                  │
│                                             │
│  存储：PostgreSQL（元信息） + MinIO（包文件） │
│                                             │
│  API：                                      │
│  ├─ POST   /packages/publish   上传配置包    │
│  ├─ GET    /packages           搜索/列表     │
│  ├─ GET    /packages/:id       详情          │
│  ├─ GET    /packages/:id/download  下载      │
│  └─ GET    /packages/:id/versions  版本历史  │
│                                             │
│  索引维度：                                   │
│  ├─ 按系统类型（ERP/CRM/通信/AI模型...）     │
│  ├─ 按厂商（用友/金蝶/招行...）              │
│  └─ 按版本兼容性                             │
└────────────────────────────────────────────┘
```

### 4.4 客户部署流程

```
1. 登录本地MCP Hub管理界面
2. 进入"配置仓库"页面
3. 搜索"用友U8" → 找到配置包
4. 点击"下载并安装"
5. 弹出鉴权配置表单（根据manifest.json动态生成）
6. 填入客户的 API Key / 账号密码 / 证书
7. 点击"测试连通性" → 通过
8. 点击"发布" → 工具进入Shard → Claw可调用
```

---

## 五、前端界面设计

### 5.1 信息架构（基于demo原型扩展）

```
导航结构：

交付流水线
├─ 系统概览（拓扑图）          ← demo已有，保留
├─ 1. 连接与鉴权               ← demo已有，保留
├─ 2. 工具库                   ← demo已有，增强
├─ 3. 部署发布                 ← demo已有，保留

开发工作台（新增）
├─ MCP生成器                   ← 核心新功能
├─ 配置仓库                    ← 核心新功能
└─ AI引擎设置                  ← 核心新功能

运维治理
├─ 运行监控                    ← demo已有，保留
└─ 审计日志                    ← demo已有，保留

系统设置（独立页面，新增）
├─ 基础设置                    ← 系统名称、语言、时区
├─ AI模型配置                  ← Provider管理、API Key、模型分配
├─ MCP传输配置                 ← 传输方式选择、端口配置
├─ Docker配置                  ← 容器管理、Volume映射
├─ 安全设置                    ← 密码策略、Session超时
└─ 关于                        ← 版本、许可、系统信息
```

### 5.2 MCP生成器页面（核心新功能）

```
┌─────────────────────────────────────────────────────────┐
│  MCP 生成器                                              │
│                                                          │
│  ┌──── 左侧：项目列表 ─────┐ ┌──── 右侧：详情面板 ────┐ │
│  │                          │ │                         │ │
│  │  📦 用友U8        12/12 ✅│ │  用友U8 (v1.0.0)       │ │
│  │  📦 企业微信      38/40 🔄│ │                         │ │
│  │  📦 SGA-RAG        9/9  ✅│ │  状态：生成中 (38/40)   │ │
│  │  📦 SGA-Matrix     6/6  ✅│ │                         │ │
│  │  📦 招行薪福通      0/6  ⏳│ │  ┌─────────────────┐   │ │
│  │                          │ │  │ Tool列表          │   │ │
│  │  [+ 新建项目]            │ │  │                   │   │ │
│  │                          │ │  │ ✅ send_text      │   │ │
│  └──────────────────────────┘ │  │ ✅ send_image     │   │ │
│                               │  │ ✅ send_file      │   │ │
│                               │  │ 🔄 send_video     │   │ │
│                               │  │    ↳ 生成中...    │   │ │
│                               │  │ ⏳ send_card      │   │ │
│                               │  │ ⏳ send_markdown  │   │ │
│                               │  │                   │   │ │
│                               │  │ ❌ batch_send     │   │ │
│                               │  │    ↳ 测试失败     │   │ │
│                               │  │    [🔧 AI修复]    │   │ │
│                               │  └─────────────────┘   │ │
│                               │                         │ │
│                               │  [▶ 全部测试] [📦 打包] │ │
│                               └─────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**新建项目流程：**

```
Step 1: 基本信息
┌──────────────────────────────────┐
│ 项目名称:  [企业微信消息        ]│
│ 系统代号:  [sga_phone           ]│
│ 分类:      [企业微信功能类    ▾] │
└──────────────────────────────────┘

Step 2: 导入文档
┌──────────────────────────────────┐
│  📂 拖入接口文档                  │
│                                   │
│  支持格式:                        │
│  ├─ Markdown（按模板）            │
│  ├─ OpenAPI 3.0 JSON/YAML        │
│  └─ Postman Collection           │
│                                   │
│  已添加:                          │
│  ├─ sga_phone_api.md    (128KB)  │
│  └─ sga_phone_auth.md   (12KB)  │
└──────────────────────────────────┘

Step 3: 配置鉴权（用于测试）
┌──────────────────────────────────┐
│ 鉴权方式: [OAuth 2.0          ▾] │
│ Corp ID:  [wx**************    ] │
│ Secret:   [****************    ] │
│                                   │
│ [测试连通性]  ✅ 200 OK (85ms)    │
└──────────────────────────────────┘

Step 4: 开始生成
┌──────────────────────────────────┐
│ AI模型: Claude Sonnet 4.5        │
│ 并行数: 5                        │
│                                   │
│ [🚀 开始生成]                     │
└──────────────────────────────────┘
```

### 5.3 AI引擎设置页面

```
┌─────────────────────────────────────────────────────────┐
│  AI 引擎设置                                             │
│                                                          │
│  ── 模型配置 ──                                          │
│                                                          │
│  模型Provider管理:                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Anthropic    API Key: sk-ant-***  [测试] ✅       │   │
│  │ DeepSeek     API Key: dk-***     [测试] ✅       │   │
│  │ 本地Ollama   http://localhost:11434  [测试] ✅    │   │
│  │ [+ 添加Provider]                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  阶段模型分配:                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 文档解析(文本):  [Claude Haiku       ▾]           │   │
│  │ 文档解析(视觉):  [Gemini Flash       ▾] ← PDF/截图│   │
│  │ 代码生成:        [Claude Sonnet 4.5  ▾]           │   │
│  │ 错误修复:        [Claude Opus        ▾]           │   │
│  │ 中文命名:        [本地 Qwen3         ▾]           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── 提示词模板 ──                                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 文档解析提示词:    [查看/编辑]  [恢复默认]         │   │
│  │ 代码生成提示词:    [查看/编辑]  [恢复默认]         │   │
│  │ 错误修复提示词:    [查看/编辑]  [恢复默认]         │   │
│  │ 命名规范提示词:    [查看/编辑]  [恢复默认]         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── 生成策略 ──                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 自动修复最大轮次:   [3] 次                         │   │
│  │ 单Tool测试超时:     [30] 秒                        │   │
│  │ 并行生成数:         [5] 个                         │   │
│  │ 错误处理策略:       [归一化到6类       ▾]          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 5.4 配置仓库页面

```
┌─────────────────────────────────────────────────────────┐
│  配置仓库                              [上传配置包]       │
│                                                          │
│  ┌─ 筛选 ──────────────────────────────────────────┐    │
│  │ 分类: [全部▾]  搜索: [__________________] [查询]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📦 用友U8 ERP                        v1.0.0      │   │
│  │    12 Tools | 系统耦合类 | 兼容U8 v12.5+          │   │
│  │    上传于: 2026-02-15                             │   │
│  │    [下载并安装]  [查看详情]                         │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📦 企业微信消息                       v1.0.0      │   │
│  │    11 Tools | 企业微信类 | 全版本兼容              │   │
│  │    上传于: 2026-02-15                             │   │
│  │    [下载并安装]  [查看详情]                         │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📦 SGA-RAG 知识库                    v2.1.0      │   │
│  │    9 Tools | 本地服务类 | 需GPU                    │   │
│  │    上传于: 2026-02-14  ⬆️ 有新版本                 │   │
│  │    [更新到v2.1.0]  [查看详情]                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 5.5 Tool测试预览面板（点击单个Tool展开）

```
┌─────────────────────────────────────────────────────────┐
│  sga_rag.search — 语义检索                    [关闭]     │
│                                                          │
│  ┌─── Schema ──────────┐ ┌─── 测试 ──────────────────┐ │
│  │                      │ │                            │ │
│  │ inputSchema:         │ │ 请求:                      │ │
│  │ {                    │ │ {                          │ │
│  │   "query": string ★  │ │   "query": "销售报告",    │ │
│  │   "collections": []  │ │   "top_k": 3              │ │
│  │   "top_k": 5         │ │ }                          │ │
│  │   "use_graph": true  │ │                            │ │
│  │ }                    │ │ [▶ 运行]                   │ │
│  │                      │ │                            │ │
│  │ outputSchema:        │ │ 响应: ✅ 200 (120ms)       │ │
│  │ {                    │ │ {                          │ │
│  │   "results": []      │ │   "results": [             │ │
│  │   "graph_context": ""│ │     { "content": "...",    │ │
│  │ }                    │ │       "score": 0.92 }      │ │
│  │                      │ │   ]                        │ │
│  └──────────────────────┘ │ }                          │ │
│                           └────────────────────────────┘ │
│                                                          │
│  生成的Connector代码:  [展开查看]                         │
└─────────────────────────────────────────────────────────┘
```

### 5.6 系统设置页面（独立页面）

设置页面从AI引擎设置中独立出来，作为全局配置中心。

```
┌─────────────────────────────────────────────────────────┐
│  系统设置                                                 │
│                                                          │
│  ┌─ 侧边Tab ─┐ ┌─ 内容区 ─────────────────────────────┐│
│  │             │ │                                       ││
│  │ 基础设置    │ │  ── 基础设置 ──                        ││
│  │ AI模型     │ │                                       ││
│  │ MCP传输    │ │  系统名称:    [MCP Hub              ] ││
│  │ Docker     │ │  系统语言:    [简体中文            ▾]  ││
│  │ 安全       │ │  时区:        [Asia/Shanghai       ▾]  ││
│  │ 关于       │ │  数据目录:    [/data/mcp-hub        ] ││
│  │             │ │                                       ││
│  └─────────────┘ │  ── MCP传输配置 ──                    ││
│                   │                                       ││
│                   │  传输方式:  ○ Streamable HTTP（推荐）  ││
│                   │            ○ stdio（仅本地开发）       ││
│                   │  监听端口:  [3000                  ]  ││
│                   │  基础路径:  [/mcp                  ]  ││
│                   │                                       ││
│                   │  ── Docker配置 ──                     ││
│                   │                                       ││
│                   │  Compose文件: [docker-compose.yml   ] ││
│                   │  数据Volume:  [/var/mcp-hub/data   ] ││
│                   │  自动重启:    [✓] 容器异常时自动重启   ││
│                   │                                       ││
│                   │  ── 安全设置 ──                       ││
│                   │                                       ││
│                   │  Session超时:    [30] 分钟             ││
│                   │  登录失败锁定:  [5] 次后锁定 [15]分钟 ││
│                   │  API限流:       [100] 次/分钟         ││
│                   │                                       ││
│                   │              [保存设置] [恢复默认]     ││
│                   └───────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

AI模型配置从这里进入（复用5.3的AI引擎设置面板内容）。

---

## 六、MCP Runtime 架构（多 Server 集群）

### 6.1 架构核心变更（v1.2 重大调整）

**问题背景：**

主流 AI 客户端（Claude Desktop、Cursor、Claw、Dify）连接 MCP Server 时，调用 `tools/list` 获取全部工具描述，并将其注入到 LLM 系统提示中。182 个 Tool 会消耗 5-9万 token，导致上下文窗口爆炸。因此客户端通常限制单个 MCP Server 的工具数为 20-40 个。

**之前的错误设计：**

```
Claw/Dify ──→ MCP Hub（单一入口）──→ 内部路由到 13 个 Shard
                tools/list 返回 182 个 Tool ← 客户端无法承受
```

**v1.2 正确架构：每个 Shard = 独立的 MCP Server**

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Hub 集群架构                       │
│                                                          │
│  ┌───────────────── 目录服务层 ──────────────────┐       │
│  │                                                │       │
│  │  Hub Control Plane (NestJS)                  │       │
│  │  - GET /api/servers → 返回可用 MCP Server 列表 │       │
│  │  - 配置管理、租户管理、包仓库                  │       │
│  │  - 不直接处理 tools/call，仅协调              │       │
│  └────────────────────────────────────────────────┘       │
│                         │                                 │
│              自动生成 docker-compose.yml                  │
│                         │                                 │
│  ┌──────────────── MCP Server 集群 ─────────────────┐    │
│  │                                                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │    │
│  │  │ MCP Server 1 │  │ MCP Server 2 │  │ Server N│ │    │
│  │  │ 企微消息      │  │ 用友 ERP     │  │ RAG     │ │    │
│  │  │ :8090        │  │ :8084        │  │ :8082   │ │    │
│  │  │ 11 tools     │  │ 12 tools     │  │ 9 tools │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────┘ │    │
│  │                                                    │    │
│  │  每个 Server 独立实现 MCP 协议：                   │    │
│  │  - tools/list（仅返回本 Shard 的工具）            │    │
│  │  - tools/call（路由到 Connector）                │    │
│  │  - 独立的鉴权、限流、健康检查                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                          │
│  客户端连接方式：                                         │
│  Claw/Dify 先调用 Hub API 获取 Server 列表，             │
│  然后按需连接所需的 MCP Server（可同时连多个）            │
└─────────────────────────────────────────────────────┘
```

**关键设计点：**

1. **每个 MCP Server = 一个 Docker 容器**，共享镜像，挂载不同配置
2. **目录服务不处理 tools/call**，仅提供 Server 发现和管理
3. **客户端可同时连接多个 MCP Server**（如 Claw 连企微+ERP+RAG）
4. **部署时自动生成 docker-compose.yml**，定义所有 Server

### 6.2 分片策略（13 个 MCP Server + Token 预算控制）

沿用原有分类，但现在每个 Shard = 一个独立的 MCP Server：

| MCP Server 名称 | 分类 | Tool数 | 预估 Token | 端口 | Docker 服务名 |
|----------------|------|--------|-----------|------|--------------|
| gpu-model | 本地算力模型 | 7 | ~2,500 | 8081 | mcp-gpu-model |
| sga-rag | SGA-RAG | 9 | ~3,200 | 8082 | mcp-sga-rag |
| sga-matrix | SGA-Matrix | 6 | ~2,100 | 8083 | mcp-sga-matrix |
| erp-yonyou | 用友ERP | 12 | ~4,500 | 8084 | mcp-erp-yonyou |
| erp-finance | 薪福通+银企 | 11 | ~4,000 | 8085 | mcp-erp-finance |
| erp-qiqi | 企企 | 5 | ~1,800 | 8086 | mcp-erp-qiqi |
| media | 新媒体+视频 | 15 | ~5,500 | 8087 | mcp-media |
| info-gathering | 信息收集 | 15 | ~5,200 | 8088 | mcp-info-gathering |
| office-docs | 办公文档 | 8 | ~3,000 | 8089 | mcp-office-docs |
| wecom-msg | 企微消息 | 11 | ~4,200 | 8090 | mcp-wecom-msg |
| wecom-meeting | 企微会议 | 7 | ~2,800 | 8091 | mcp-wecom-meeting |
| wecom-mail | 企微邮箱 | 9 | ~3,500 | 8092 | mcp-wecom-mail |
| wecom-calendar | 企微日历+提醒 | 13 | ~4,800 | 8093 | mcp-wecom-calendar |

**Token 预算约束：** 单个 Server 的 `tools/list` 响应 ≤ 8,000 token（安全边界）

#### Token 预算检查机制（关键设计）

**问题：** 工具数量 ≤40 不等于 token 可控。一个复杂的 ERP Tool（大 inputSchema + 详细描述）可能消耗 800+ token，而简单的 Tool 只需 150 token。

**解决方案：自动 Token 预算检查**

```typescript
// 在部署/配置变更时自动执行
async function validateServerTokenBudget(serverId: string) {
  const tools = await getServerTools(serverId);

  // 序列化为 MCP tools/list 格式
  const toolsListPayload = {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,  // 完整 JSON Schema
      // ... 其他字段
    }))
  };

  // 计算 token 数（使用 tiktoken 或类似库）
  const tokenCount = estimateTokens(JSON.stringify(toolsListPayload));
  const BUDGET_LIMIT = 8000;  // 安全阈值
  const WARN_THRESHOLD = 6000;

  if (tokenCount > BUDGET_LIMIT) {
    throw new Error(
      `Server ${serverId} exceeds token budget: ${tokenCount} > ${BUDGET_LIMIT}. ` +
      `Auto-split required.`
    );
  }

  if (tokenCount > WARN_THRESHOLD) {
    logger.warn(
      `Server ${serverId} approaching token limit: ${tokenCount}/${BUDGET_LIMIT}. ` +
      `Consider splitting.`
    );
  }

  return { tokenCount, withinBudget: true };
}
```

**自动拆分策略：**

如果某个 Server 超过 8,000 token 预算：

1. **手动拆分**：提示管理员按业务逻辑拆分（如 ERP 拆成"查询类"和"写入类"）
2. **自动建议**：AI 分析 Tool 的语义相似度，建议拆分方案
3. **紧急降级**：临时禁用描述最长的 Tool，直到手动拆分完成

**前端展示：**
- 部署发布页面显示每个 Server 的 Token 使用率（进度条）
- 超过 75% 显示黄色警告，超过 100% 红色阻止部署

### 6.3 目录服务 API（Hub Control Plane）

Hub 不再处理 `tools/call`，而是提供目录服务和管理功能：

#### 核心 API

```typescript
// Server 发现
GET /api/servers
Response: {
  servers: [
    {
      id: "wecom-msg",
      name: "企业微信消息",
      endpoint: "http://localhost:8090/mcp",
      transport: "streamable-http",
      toolCount: 11,
      status: "healthy",
      category: "企业微信",
      tags: ["消息", "通知", "即时通讯"]
    },
    ...
  ]
}

// Server 详情
GET /api/servers/:id
Response: {
  ...server,
  tools: [
    { name: "wecom.send_text", displayName: "发送文本消息", ... },
    ...
  ],
  health: { uptime: 3600, lastCheck: "2026-02-15T10:00:00Z" },
  config: { requiresAuth: true, authType: "oauth2" }
}

// 部署管理
POST /api/deploy
Body: { enabledServers: ["wecom-msg", "erp-yonyou", ...] }
Response: { composeFile: "...", status: "deploying" }
```

#### Hub 基础设施模块

| 模块 | 职责 | 变更 |
|------|------|------|
| Server Registry | MCP Server 注册、发现、健康状态管理 | 替代原 Tool Registry |
| Auth Vault | 凭证加密存储（见 6.7） | 替代 Auth Gate，新增加密 |
| Deploy Orchestrator | 生成 docker-compose、滚动更新 | 新增 |
| Health Monitor | 各 Server 健康检查和自动重启 | 保留 |
| Async Task Queue | AI 生成引擎、耗时工具的队列 | 保留 |
| GPU Scheduler | GPU 资源调度（多模型共享显卡） | 保留 |
| File Storage | 文件中转存储（TTS 音频、生成的图片/视频） | 保留 |

**关键差异：**
- 不再有中央 Router（每个 Server 独立处理调用）
- Server Registry 管理 Server 级别的元数据，而非 Tool 级别

### 6.4 MCP Server 认证与传输安全

**问题：** docker-compose 直接暴露端口（8081-8093），任何能访问网络的人都能调用 MCP Server，进而使用存储的凭证操作企业系统。

**解决方案：分层认证**

#### 方案 A：TLS + Tenant API Key（推荐用于生产）

```
客户端（Claw/Dify）
    │
    │ HTTPS (TLS 1.3)
    │ Header: Authorization: Bearer <tenant-api-key>
    ↓
MCP Server (Nginx 反向代理)
    │
    ├─ 1. 验证 TLS 证书（可选 mTLS）
    ├─ 2. 验证 Tenant API Key（从 Auth Vault 获取哈希）
    ├─ 3. 提取 tenant_id，注入到上下文
    │
    ↓ 通过后转发到内部 NestJS
    │
MCP Protocol Handler
    │
    └─ 所有 Connector 调用只能访问该 tenant_id 的凭证
```

**API Key 验证流程：**

```typescript
// Nginx Lua 或 NestJS Guard
async function verifyTenantApiKey(req: Request) {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) throw new UnauthorizedException('Missing API key');

  // 从 Auth Vault 查询（仅存储哈希）
  const keyRecord = await authVault.findByHash(sha256(apiKey));
  if (!keyRecord || keyRecord.expiresAt < now()) {
    throw new UnauthorizedException('Invalid or expired API key');
  }

  // 检查作用域（read/write）和速率限制
  await rateLimiter.check(keyRecord.id, keyRecord.quotaPerMinute);

  // 注入租户上下文
  req.tenant = { id: keyRecord.tenantId, scopes: keyRecord.scopes };
  return next();
}
```

#### 方案 B：stdio（仅本地开发）

本地单机开发时，MCP Server 通过 stdio 运行（不暴露端口），客户端直接启动进程，无需认证。生产环境禁用。

#### TLS 证书管理

```yaml
# docker-compose.yml 增强版
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "443:443"  # 统一 HTTPS 入口
    volumes:
      - ./certs:/etc/nginx/certs:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - mcp-wecom-msg
      - mcp-erp-yonyou
      # ...

  mcp-wecom-msg:
    # 不再直接暴露端口，仅内网访问
    expose: ["3000"]
```

**证书方案：**
- 开发环境：自签名证书（openssl 生成）
- 生产环境：Let's Encrypt 或企业 CA 颁发的证书

### 6.5 MCP Server 内部架构（单个 Server）

每个 MCP Server 是独立的 NestJS 应用：

```
mcp-server (Docker 容器)
├─ MCP Protocol Handler
│   ├─ tools/list → 读取本 Server 的 Tool 清单
│   ├─ tools/call → 路由到对应 Connector
│   └─ health → 健康检查端点
├─ Connector Runtime
│   ├─ 动态加载已启用的 Connector 代码
│   ├─ 连接池管理（HTTP/gRPC 复用）
│   └─ 限流器（per-tool QPS 控制）
├─ Auth Module
│   ├─ 从 Auth Vault 获取凭证（加密通道）
│   ├─ OAuth2 refresh token 自动刷新
│   └─ 凭证缓存（内存，过期自动清除）
└─ Observability
    ├─ Prometheus metrics
    ├─ 结构化日志（JSON Lines）
    └─ 分布式追踪（OpenTelemetry）
```

**并发控制：**

| 层次 | 机制 | 配置示例 |
|------|------|---------|
| 连接池 | HTTP Agent keep-alive | maxSockets: 50 per host |
| 限流器 | 令牌桶（per-tool） | wecom.send_text: 20 req/s |
| 熔断器 | 失败率阈值熔断 | 连续失败 5 次 → 熔断 30s |
| 队列 | 异步工具走 BullMQ | 视频生成、批量导入等 |

**实际并发能力：**
- 单 Server 进程：200-500 并发（I/O 密集）
- 如需更高：PM2 cluster 模式（多进程负载均衡）
- 企业典型场景：5-20 并发 Agent，单进程足够

### 6.5 MCP传输方式

| 传输方式 | 状态 | 适用场景 |
|---------|------|---------|
| **Streamable HTTP**（推荐） | MCP新标准，主推 | 网络部署、跨机调用、多租户 |
| stdio | 可选支持 | 本地单机开发调试 |
| SSE | 已弃用，不实现 | — |

默认使用Streamable HTTP。设置页面可切换传输方式。

### 6.6 Docker部署架构

#### 云端配置仓库（Docker化）

```
mcp-hub-cloud/
├── docker-compose.yml
├── services/
│   ├── api/          # NestJS API服务
│   ├── postgres/     # 元数据存储
│   ├── redis/        # 缓存+限流
│   └── minio/        # 配置包文件存储
└── nginx/            # 反向代理 + HTTPS
```

云端认证方案：
- API Key认证（租户级别）
- 每个Key绑定租户ID、过期时间、调用限额
- 下载配置包需有效Key
- 上传限管理员账号

#### 客户本地部署（Docker化 + Volume持久化）

**自动生成的 docker-compose.yml 示例：**

```yaml
version: '3.8'
services:
  # Hub Control Plane
  hub-api:
    image: mcp-hub/control-plane:latest
    ports: ["3000:3000"]
    volumes:
      - pg-data:/var/lib/postgresql/data
      - redis-data:/var/lib/redis
      - minio-data:/var/lib/minio
      - ./config:/app/config:ro
    environment:
      - MASTER_KEY_FILE=/run/secrets/master_key
    secrets:
      - master_key

  # MCP Server 1: 企微消息
  mcp-wecom-msg:
    image: mcp-hub/server:latest
    ports: ["8090:3000"]
    volumes:
      - ./servers/wecom-msg/config.json:/app/config.json:ro
      - ./servers/wecom-msg/connectors:/app/connectors:ro
    environment:
      - AUTH_VAULT_URL=http://hub-api:3000/vault
      - SERVER_ID=wecom-msg

  # MCP Server 2: 用友 ERP
  mcp-erp-yonyou:
    image: mcp-hub/server:latest
    ports: ["8084:3000"]
    volumes:
      - ./servers/erp-yonyou/config.json:/app/config.json:ro
      - ./servers/erp-yonyou/connectors:/app/connectors:ro
    environment:
      - AUTH_VAULT_URL=http://hub-api:3000/vault
      - SERVER_ID=erp-yonyou

  # ... 其他 11 个 MCP Server

volumes:
  pg-data:
  redis-data:
  minio-data:

secrets:
  master_key:
    file: ./secrets/master.key
```

**关键设计：**
- Hub 和所有 MCP Server 共用同一镜像（`mcp-hub/server`），通过挂载配置区分
- 每个 Server 的 Connector 代码和配置独立目录
- 凭证不存 .env，而是加密存储在 Auth Vault（见 6.7）
- Volume 持久化 + Docker secrets 管理主密钥

### 6.7 凭证加密存储（Auth Vault）— 实现细节

**问题：** Codex 审查指出 `.env` 明文存储 API Key/密码是严重安全隐患。

**解决方案：Auth Vault 服务（AES-256-GCM + AAD）**

#### 数据库 Schema

```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  server_id VARCHAR(50) NOT NULL,  -- 如 'wecom-msg', 'erp-yonyou'
  key_name VARCHAR(100) NOT NULL,  -- 如 'api_key', 'oauth_client_secret'

  -- 加密字段
  encrypted_value BYTEA NOT NULL,  -- AES-256-GCM 密文
  encryption_iv BYTEA NOT NULL,    -- 初始化向量（IV），每次加密随机生成
  auth_tag BYTEA NOT NULL,         -- GCM 认证标签（防篡改）
  key_version INT NOT NULL,        -- 主密钥版本号（支持轮换）

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,

  -- 索引和约束
  UNIQUE(tenant_id, server_id, key_name),
  CHECK(octet_length(encryption_iv) = 12),  -- GCM 标准 IV 长度
  CHECK(octet_length(auth_tag) = 16)        -- GCM 标准 tag 长度
);

CREATE INDEX idx_credentials_tenant ON credentials(tenant_id);
CREATE INDEX idx_credentials_server ON credentials(server_id);
```

#### 加密实现（AES-256-GCM + AAD）

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class AuthVault {
  private masterKeys: Map<number, Buffer>;  // version -> key

  /**
   * 加密凭证
   * AAD (Additional Authenticated Data) 绑定上下文，防止密文被移动到其他记录
   */
  async encrypt(
    plaintext: string,
    tenantId: string,
    serverId: string,
    keyName: string
  ): Promise<EncryptedCredential> {
    const keyVersion = this.getCurrentKeyVersion();
    const masterKey = this.masterKeys.get(keyVersion);
    const iv = randomBytes(12);  // GCM 标准 IV 长度

    // AAD: 绑定租户、Server、密钥名称、版本
    const aad = Buffer.from(
      JSON.stringify({ tenantId, serverId, keyName, keyVersion })
    );

    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encrypted,
      encryptionIv: iv,
      authTag,
      keyVersion
    };
  }

  /**
   * 解密凭证
   */
  async decrypt(
    encrypted: EncryptedCredential,
    tenantId: string,
    serverId: string,
    keyName: string
  ): Promise<string> {
    const masterKey = this.masterKeys.get(encrypted.keyVersion);
    if (!masterKey) {
      throw new Error(`Master key version ${encrypted.keyVersion} not found`);
    }

    // 重建 AAD（必须与加密时一致）
    const aad = Buffer.from(
      JSON.stringify({
        tenantId,
        serverId,
        keyName,
        keyVersion: encrypted.keyVersion
      })
    );

    const decipher = createDecipheriv(
      'aes-256-gcm',
      masterKey,
      encrypted.encryptionIv
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(encrypted.authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted.encryptedValue),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      // AAD 不匹配或密文被篡改会导致解密失败
      throw new Error('Decryption failed: tampered or mismatched context');
    }
  }
}
```

#### 主密钥管理

```yaml
# docker-compose.yml
secrets:
  master_key_v1:
    file: ./secrets/master_v1.key  # 32 字节随机数据
  master_key_v2:
    file: ./secrets/master_v2.key  # 轮换后的新密钥

services:
  hub-api:
    secrets:
      - master_key_v1
      - master_key_v2
    environment:
      - MASTER_KEY_V1_PATH=/run/secrets/master_key_v1
      - MASTER_KEY_V2_PATH=/run/secrets/master_key_v2
      - CURRENT_KEY_VERSION=2
```

**密钥轮换流程：**

1. 生成新主密钥 v2
2. 启动时加载 v1 和 v2
3. 新凭证用 v2 加密
4. 后台任务逐步重新加密旧凭证（v1 解密 → v2 加密）
5. 所有凭证迁移完成后删除 v1

#### 租户隔离强制

```typescript
// MCP Server 调用 Vault API 时必须携带 JWT
async function getCredential(serverId: string, keyName: string, jwt: string) {
  const { tenantId } = verifyJWT(jwt);  // 从 JWT 提取 tenant_id

  const record = await db.query(
    `SELECT * FROM credentials
     WHERE tenant_id = $1 AND server_id = $2 AND key_name = $3`,
    [tenantId, serverId, keyName]
  );

  if (!record) throw new NotFoundException();

  // 解密时必须提供正确的上下文（AAD 校验）
  return vault.decrypt(record, tenantId, serverId, keyName);
}
```

**PostgreSQL RLS（行级安全）作为第二道防线：**

```sql
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON credentials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**工作流程：**

1. **用户配置阶段：**
   - 用户在前端填入 API Key/密码
   - 前端通过 HTTPS POST 到 Hub API
   - Hub API 用主密钥加密后存入 PostgreSQL
   - 前端显示"已保存"，不再回显原始值

2. **运行时获取：**
   - MCP Server 启动时从 Vault 获取凭证
   - 凭证缓存在内存（设置 TTL，如 1 小时）
   - 过期自动从 Vault 刷新

3. **密钥轮换：**
   - 生成新主密钥（v2）
   - 旧凭证用 v1 解密，用 v2 重新加密
   - 删除 v1 密钥

**安全边界：**
- MCP Server 只能访问自己 `server_id` 的凭证
- 租户隔离通过 `tenant_id` 强制隔离
- 审计日志记录所有凭证访问（脱敏）

---

## 6.8 云端管理后台

云端配置仓库需要一个轻量级管理界面，供平台管理员使用。

### 功能清单

```
云端管理后台
├─ 登录（管理员账号密码）
├─ 仪表盘
│   ├─ 配置包总数、总下载量
│   ├─ 活跃租户数、近7日趋势
│   └─ 存储用量（MinIO）
├─ 租户管理
│   ├─ 租户列表（名称、联系人、状态、创建时间）
│   ├─ 创建租户
│   ├─ 禁用/启用租户
│   └─ 查看租户的下载记录
├─ API Key管理
│   ├─ Key列表（关联租户、创建时间、过期时间、调用次数）
│   ├─ 生成新Key（指定租户、有效期、调用限额）
│   ├─ 吊销Key
│   └─ 查看Key的调用日志
├─ 配置包管理
│   ├─ 包列表（名称、版本、上传时间、下载次数）
│   ├─ 上下架操作
│   ├─ 版本管理（查看历史版本、回滚）
│   └─ 删除配置包
└─ 系统设置
    ├─ 管理员密码修改
    ├─ 存储配额设置
    └─ 日志保留策略
```

### 技术方案

- 复用Vue3 + Ant Design Vue技术栈
- 独立前端项目（或同项目不同路由前缀 `/admin`）
- 共享后端NestJS服务，通过角色权限区分
- 管理员认证：JWT + 密码哈希（bcrypt）

---

## 6.9 租户隔离实现规范

### PostgreSQL 行级安全（RLS）

所有多租户表强制启用 RLS：

```sql
-- 示例：credentials 表
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_credentials ON credentials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 示例：tool_configs 表
ALTER TABLE tool_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tools ON tool_configs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 应用层设置租户上下文（每个请求开始时）
-- SET LOCAL app.current_tenant_id = '<tenant-uuid>';
```

**NestJS 实现：**

```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.tenant?.id;  // 从 JWT 或 API Key 提取

    if (!tenantId) throw new UnauthorizedException('Missing tenant context');

    // 在数据库连接上设置租户上下文
    return from(
      this.dataSource.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId])
    ).pipe(
      switchMap(() => next.handle())
    );
  }
}
```

### MinIO 租户隔离

**方案 A：按租户分 Bucket**

```typescript
// 每个租户独立 bucket
const bucketName = `tenant-${tenantId}`;
await minioClient.makeBucket(bucketName, 'us-east-1');

// Bucket Policy：仅该租户可访问
await minioClient.setBucketPolicy(bucketName, {
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Principal: { AWS: [`arn:aws:iam::tenant:${tenantId}`] },
    Action: ['s3:GetObject', 's3:PutObject'],
    Resource: [`arn:aws:s3:::${bucketName}/*`]
  }]
});
```

**方案 B：共享 Bucket + 前缀隔离**

```typescript
// 所有租户共享一个 bucket，按前缀隔离
const objectKey = `tenants/${tenantId}/packages/${packageId}.tar.gz`;

// 应用层强制检查（每次读写前验证）
function validateTenantAccess(objectKey: string, tenantId: string) {
  if (!objectKey.startsWith(`tenants/${tenantId}/`)) {
    throw new ForbiddenException('Cross-tenant access denied');
  }
}
```

推荐方案 A（独立 Bucket），隔离性更强。

---

## 6.10 配置包签名与验证（供应链安全）

### 签名流程（发布时）

```typescript
import { createSign, createVerify } from 'crypto';

async function signPackage(packagePath: string, privateKey: Buffer) {
  // 1. 计算包的 SHA-256 哈希
  const packageBuffer = await fs.readFile(packagePath);
  const hash = createHash('sha256').update(packageBuffer).digest();

  // 2. 用私钥签名哈希
  const sign = createSign('RSA-SHA256');
  sign.update(hash);
  const signature = sign.sign(privateKey, 'base64');

  // 3. 生成签名清单
  const manifest = {
    packageHash: hash.toString('hex'),
    signature,
    signedBy: 'admin@company.com',
    signedAt: new Date().toISOString(),
    algorithm: 'RSA-SHA256'
  };

  // 4. 附加到包元数据
  await fs.writeFile(`${packagePath}.sig`, JSON.stringify(manifest));
}
```

### 验证流程（安装时）

```typescript
async function verifyPackage(packagePath: string, publicKey: Buffer) {
  const packageBuffer = await fs.readFile(packagePath);
  const manifest = JSON.parse(
    await fs.readFile(`${packagePath}.sig`, 'utf8')
  );

  // 1. 重新计算包哈希
  const actualHash = createHash('sha256').update(packageBuffer).digest('hex');
  if (actualHash !== manifest.packageHash) {
    throw new Error('Package integrity check failed: hash mismatch');
  }

  // 2. 验证签名
  const verify = createVerify('RSA-SHA256');
  verify.update(Buffer.from(manifest.packageHash, 'hex'));
  const isValid = verify.verify(publicKey, manifest.signature, 'base64');

  if (!isValid) {
    throw new Error('Package signature verification failed');
  }

  // 3. 检查发布者白名单
  const allowedPublishers = await getConfig('ALLOWED_PUBLISHERS');
  if (!allowedPublishers.includes(manifest.signedBy)) {
    throw new Error(`Publisher ${manifest.signedBy} not in allowlist`);
  }

  return { verified: true, signedBy: manifest.signedBy };
}
```

### 密钥管理

```yaml
# 发布者私钥（仅管理员持有，不存 Git）
secrets/publisher_private.pem  # 4096-bit RSA

# 公钥分发（可公开，写入配置）
config/publisher_public.pem

# docker-compose.yml
services:
  hub-api:
    secrets:
      - publisher_private_key
    environment:
      - PUBLISHER_PUBLIC_KEY_PATH=/app/config/publisher_public.pem
```

### SBOM（软件物料清单）

发布时生成 SBOM，记录依赖树：

```json
{
  "package": "erp-yonyou-v1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "@nestjs/common": "^10.0.0",
    "zod": "^3.22.0"
  },
  "generatedBy": "AI Engine v1.2",
  "scanResult": {
    "vulnerabilities": [],
    "license": "MIT"
  }
}
```

安装时检查 SBOM，拒绝已知漏洞的包。

---

## 七、Agent Team 分工方案

### 7.1 核心原则

一个人 + AI代理团队。人做决策和验收，AI做所有编码和测试。

```
你（项目负责人）
├── 决策：架构选型、产品设计、需求优先级
├── 验收：代码审查、功能验收、质量把关
├── 输入：接口文档编写、业务规则定义
└── 协调：管理Claude/Codex/Gemini的任务分配

Claude（架构师 / 项目经理）
├── 需求分析、任务拆分
├── 接口契约定义（前后端、模块间）
├── 代码审查（review Codex/Gemini的产出）
├── Git管理
└── 通过Auggie获取跨仓库上下文

Codex（后端开发 + 核心引擎）
├── NestJS后端所有模块
├── AI生成引擎（文档解析器、代码生成器、修复器）
├── MCP Runtime（Data Plane、Shard管理）
├── 配置仓库后端
├── 数据库Schema + Migration
└── 后端单元测试 + 集成测试

Gemini（前端开发 + UI/UX）
├── Vue3前端所有页面
├── 开发工作台界面（生成器、仓库、AI设置）
├── 运维界面（监控、审计、部署）
├── 组件库搭建
└── 前端与后端API对接
```

### 7.2 六阶段开发计划

**每阶段内，Codex和Gemini尽量并行工作。**
**Claude在每阶段开始时定义接口契约，阶段结束时做Code Review。**

---

#### Phase 1: 骨架搭建（第1周）

```
Claude:
  ├─ 定义项目目录结构
  ├─ 定义前后端接口契约（OpenAPI格式）
  └─ 定义数据库Schema

Codex（并行）:                    Gemini（并行）:
  ├─ NestJS项目初始化               ├─ Vue3项目初始化（Vite + Ant Design Vue + Pinia）
  ├─ PostgreSQL + Redis配置         ├─ 布局框架（侧边栏 + Vue Router）
  ├─ 基础模块（Auth、Config）       ├─ 组件库基础（表格、表单、弹窗）
  └─ MinIO对接                      └─ 基于demo风格的主题系统

产出: 前后端项目骨架可运行
```

---

#### Phase 2: AI生成引擎 + 安全基础（第2-3周）— 最核心

```
Claude:
  ├─ 设计生成引擎的Prompt模板
  ├─ 定义IR（中间表示）数据结构
  ├─ 设计沙箱执行环境规范
  ├─ 设计 Auth Vault 加密方案
  └─ Review生成代码质量

Codex:
  ├─ 文档解析器（Markdown模板 → IR）
  ├─ 文档解析器（OpenAPI → IR，适配器模式）
  ├─ Tool定义生成器（IR → JSON Schema + Zod）
  ├─ Connector代码生成器（IR → TypeScript代码）
  ├─ 测试用例生成器（IR → 测试代码）
  ├─ Sandbox Worker（Docker容器 + BullMQ集成）
  ├─ 测试运行器（沙箱内执行，资源限制）
  ├─ AI修复循环器（错误分析 → 代码修改 → 重测）
  ├─ Auth Vault（凭证加密存储 + API）
  └─ 主密钥管理（Docker secrets集成）

Gemini:
  ├─ MCP生成器页面（项目列表 + 详情面板）
  ├─ 文档导入组件（拖拽上传 + 格式识别）
  ├─ 生成进度展示（实时状态 + 日志流，SSE）
  ├─ AI引擎设置页面（模型配置 + 提示词编辑）
  ├─ Tool测试预览面板
  └─ 凭证配置表单（动态生成，不回显敏感信息）

产出: 可以上传API文档 → AI自动生成MCP代码（沙箱执行）→ 测试 → 凭证加密存储
```

---

#### Phase 3: 配置仓库 + 打包 + 云端管理后台（第4周）

```
Codex:                            Gemini:
  ├─ 配置包打包逻辑                  ├─ 配置仓库浏览页面
  ├─ 配置仓库API（CRUD + 版本管理）  ├─ 上传/下载交互
  ├─ Cloud端存储对接                 ├─ 鉴权配置动态表单
  ├─ 配置包下载 + 安装逻辑          ├─ 版本对比/更新提示
  ├─ 租户管理API                    ├─ 云端管理后台（/admin）
  ├─ API Key生成/吊销/限额          │   ├─ 仪表盘
  ├─ Docker化部署脚本               │   ├─ 租户管理页面
  └─ 云端认证中间件                  │   ├─ API Key管理页面
                                     │   └─ 配置包管理页面
                                     └─ 系统设置页面

产出: 打包 → 上传云端 → 云端管理（开Key/管租户） → 下载安装 → 填鉴权 → 可用
```

---

#### Phase 4: MCP Runtime（多 Server 集群）（第5周）

```
Codex:                            Gemini:
  ├─ MCP Server 核心                 ├─ Server 目录服务 UI
  │   ├─ MCP 协议实现（tools/*）     ├─ 系统概览（拓扑图，AntV G6）
  │   ├─ Connector 动态加载          ├─ 部署发布页面
  │   ├─ 连接池 + 限流器             │   ├─ 选择启用的 Server
  │   └─ 健康检查端点                │   ├─ 预览 docker-compose
  ├─ Deploy Orchestrator             │   └─ 一键部署按钮
  │   ├─ 自动生成 docker-compose     ├─ Server 状态监控
  │   ├─ 滚动更新逻辑                │   ├─ 13 个 Server 卡片
  │   └─ 健康检查调度                │   └─ 实时健康状态
  ├─ Server Registry                 └─ 工具库页面（虚拟滚动）
  │   ├─ /api/servers 端点
  │   └─ 元数据管理
  └─ Docker 镜像构建

产出: 完整的 MCP Server 集群可运行，客户端可发现并连接多个 Server
```

---

#### Phase 5: Hub基础设施（第6周）

```
Codex:                            Gemini:
  ├─ Auth Gate（统一鉴权中心）       ├─ 连接与鉴权页面
  ├─ GPU Scheduler                  ├─ 运行监控页面
  ├─ Async Task Queue               ├─ 审计日志页面
  ├─ File Storage                   └─ 审计详情侧边栏
  ├─ 审计日志后端
  └─ 限流/重试/断路器

产出: 完整的治理能力
```

---

#### Phase 6: 集成测试 + 上线（第7-8周）

```
全员:
  ├─ 端到端测试（上传文档 → 生成 → 部署 → Claw调用）
  ├─ 性能测试（182个Tool全部生成）
  ├─ 安全审查（鉴权、脱敏、审计）
  ├─ 修复Bug
  └─ 文档完善
```

### 7.3 并行委派示例

Phase 2开始时，Claude的委派指令：

```
# 同时发出两个任务

/ask codex "[TASK] 实现AI生成引擎的文档解析器模块
[FILES] src/generator/parsers/markdown-parser.ts
[CONTEXT] 解析标准Markdown接口文档模板（模板定义见设计文档3.2节），
输出IR中间表示。IR结构：
{
  system: { code, baseUrl, auth },
  tools: [{ name, displayName, method, path, params, response, errors, examples }]
}
[CRITERIA] 1) 解析模板所有字段 2) 单元测试覆盖 3) 错误提示清晰"

/ask gemini "[TASK] 实现MCP生成器页面
[FILES] src/views/Generator/index.vue
[CONTEXT] 页面设计见设计文档5.2节。左侧项目列表，右侧详情面板。Vue3 Composition API + TypeScript。
需要的组件：ProjectList.vue, ProjectDetail.vue, ToolStatusList.vue, ImportModal.vue
[INTERFACE] 后端API：
  POST /api/generator/projects — 创建项目
  GET /api/generator/projects/:id — 项目详情
  POST /api/generator/projects/:id/generate — 开始生成
  GET /api/generator/projects/:id/status — 生成状态（Streamable HTTP）
[CRITERIA] 1) 基于demo的视觉风格 2) 实时状态更新 3) 响应式布局"
```

---

## 八、关键设计决策汇总

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 语言 | TypeScript全栈 | MCP SDK原生、前后端统一 |
| 2 | MCP底座 | 适配器模式集成 openapi-mcp-generator | 依赖上游版本，最小封装，避免 fork 维护成本 |
| 3 | 产品形态 | Web工作台（非IDE） | 人不碰代码，AI全自动 |
| 4 | 文档输入 | 标准Markdown模板 + OpenAPI | 自研系统用模板，大厂用OpenAPI |
| 5 | AI模型 | 多模型分层 | Haiku解析/Sonnet生成/Opus修复 |
| 6 | 配置分发 | Cloud配置仓库 | 开发一次，客户部署只需填鉴权 |
| 7 | 前端框架 | Vue3 + TS + Ant Design Vue + Pinia | React有CVE安全漏洞，Vue3更稳定 |
| 8 | 后端框架 | NestJS | 模块化强，适合平台型 |
| 9 | Runtime架构 | 13个独立 MCP Server + 目录服务 | 解决上下文限制，每个 Server ≤8000 token |
| 10 | Token 预算 | tools/list 自动检查 + 告警/拆分 | 防止单个 Server schema 过大导致客户端拒绝 |
| 11 | 端点认证 | TLS + Tenant API Key | Nginx 反向代理 + Bearer Token 验证 |
| 12 | 凭证存储 | Auth Vault（AES-256-GCM + AAD） | 主密钥 Docker secrets，IV/nonce 随机，支持轮换 |
| 13 | 沙箱执行 | 独立 Worker + 网络白名单 + tmpfs | 资源隔离，iptables 严格出站控制，禁 Docker socket |
| 14 | 租户隔离 | PostgreSQL RLS + MinIO 独立 Bucket | DB 行级安全 + 对象存储物理隔离 |
| 15 | 供应链安全 | 配置包签名（RSA-SHA256）+ SBOM | 发布者私钥签名，安装时验证 + 白名单 |
| 12 | 团队模式 | 1人 + Claude/Codex/Gemini | Claude管理，Codex后端，Gemini前端 |
| 13 | MCP传输 | Streamable HTTP（默认）+ stdio（可选） | 新标准，SSE已弃用 |
| 14 | 部署方式 | 自动生成 docker-compose.yml | 根据启用的 Server 动态生成 |
| 15 | 云端管理 | 轻量级管理后台（/admin） | 租户管理、API Key发放、配置包管理 |
| 16 | 设置页面 | 独立全局配置中心 | 基础/AI模型/传输/Docker/安全统一管理 |

---

## 九、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| AI生成的代码质量不稳定 | 需要大量人工修复 | 设计好Prompt模板 + 自动修复循环 + 标准化接口文档模板 + 失败时明确标记需人工介入 |
| 一人开发进度风险 | 8周可能不够 | 严格按优先级：先AI引擎→再Runtime→最后治理；凭证加密、沙箱执行在 Phase 2 完成 |
| 企业鉴权复杂度 | 银企直联/HMAC等非标准鉴权 | 这类Tool单独处理，不走全自动生成 |
| MCP协议演进 | 协议变更导致改动 | 适配器模式集成 openapi-mcp-generator，定期同步上游 |
| 凭证泄露风险 | 用户敏感信息暴露 | Auth Vault 加密存储 + 主密钥分离 + 审计日志 + 沙箱网络隔离 |
| 并发瓶颈 | 多 Agent 同时调用卡顿 | 连接池 + 限流 + 熔断 + GPU Scheduler；实测优化 |
| 上下文限制 | 单个 MCP Server 工具过多导致客户端拒绝 | 架构已调整为多 Server（每个 ≤40 Tool） |

---

## 十、优先级裁剪（如果时间不够）

**必须有（没有就不能用）：**
- AI生成引擎（文档→MCP代码→测试，含沙箱执行）
- Auth Vault（凭证加密存储）
- MCP Runtime（多 Server 集群 + 目录服务）
- Deploy Orchestrator（自动生成 docker-compose）
- 基础前端（生成器 + 部署 + Server 目录）

**应该有（企业部署需要）：**
- 配置仓库（Cloud端上传/下载）
- 云端管理后台（租户/Key管理）
- 审计日志
- 系统设置页面
- 并发控制（连接池 + 限流 + 熔断）

**可以后做（锦上添花）：**
- GPU Scheduler（如果没有 GPU 密集型工具可暂缓）
- 运行监控大盘（Prometheus + Grafana）
- 灰度发布（分阶段启用新 Server）
- 配置版本Diff（对比不同版本的配置包）
- AI 修复循环的高级策略（当前 3 轮已够用）
