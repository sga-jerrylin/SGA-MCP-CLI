# SGA-Molt 平台 — Claw 侧需求清单

> **项目内部代号：** SGA-Molt（基于 OpenClaw 的企业级智能体纳管平台）
> **文档用途：** 嘉鑫负责的 Claw 主体改造需求列表 + 实现思路
> **编写日期：** 2026-02-15
> **关联方：** MCP Hub 侧由我负责，本文档聚焦 Claw 侧需要新增和改造的部分

---

## 一、整体架构定位

我们将 OpenClaw 改造为 **SGA-Molt 智能体纳管平台**，核心架构分层如下：

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
   │   │             记忆层                     │ │
   │   │  私有记忆 ┃ 共享记忆 ┃ Claw 原生记忆   │ │
   │   └──────────────────────────────────────┘ │
   │         │                                   │
   │   ┌─────▼────────────────────────────────┐ │
   │   │           MCP Hub（我负责）            │ │
   │   │  ERP │ CRM │ SGA-RAG │ DB │ 邮件 │…  │ │
   │   │         统一鉴权 + Tool 注册           │ │
   │   └──────────────────────────────────────┘ │
   └─────────────────────────────────────────────┘
```

**核心分工：**

- **嘉鑫：** 负责 Claw 主体（Gateway、Agent Runtime、前端、调度、记忆改造等）
- **我：** 负责 MCP Hub（所有外部 Tool 的封装、鉴权、SGA-RAG 接入等）

**Skill 与 MCP 的关系是上下游：**

- Skill = 编排层（Prompt 性质的工作流，定义"做什么"和"怎么做"）
- MCP Tool = 执行层（真正去 ERP 查表、往 CRM 写数据、查知识库）
- Skill 调用 MCP Tool 来完成实际操作，Skill 本身不直接执行外部系统操作

**智能体四元组定义：**

| 组成 | 在 SGA-Molt 中对应 |
|------|-------------------|
| Soul（Prompt/人格） | AGENTS.md + Skill 定义 |
| Memory（记忆） | 分层记忆系统（见需求3） |
| Knowledge（知识库） | SGA-RAG（重型）+ Claw 记忆（轻型） |
| Tools（工具） | MCP Hub 提供 |

---

## 二、需求清单（按优先级排列）

### ■ 第一批：MVP 必须完成

---

### 需求 1：主 Agent 生产界面

**优先级：P0**

**需求说明：**

需要一个前端界面，支持创建和管理主 Agent，以及由主 Agent 生成 Sub-Agent 团队。

**核心功能：**

1. **创建主 Agent 流程化界面：**
   - 选择模型 Provider 和具体模型
   - 编辑 Soul（系统 Prompt / 人格定义）
   - 绑定可用的 Skill 列表
   - 绑定可用的 MCP Tool 范围（从 MCP Hub 拉取已注册的 Tool 列表）
   - 绑定知识库（选择 SGA-RAG 的 collection 和/或 Claw 记忆空间）
   - 设置记忆策略（私有 / 共享 / 继承主 Agent）

2. **主 Agent 生成 Sub-Agent 的流程：**
   - 主 Agent 可通过对话或界面操作创建 Sub-Agent
   - 创建时自动继承主 Agent 的部分配置（可覆盖）
   - Sub-Agent 的 Soul、Skill、Tool 权限、模型可独立配置
   - 支持"Agent 模板"——保存常用配置为模板，快速复用

3. **Agent 团队可视化：**
   - 树形或拓扑图展示主 Agent 和 Sub-Agent 的关系
   - 显示每个 Agent 的状态（运行中 / 空闲 / 异常）

**实现思路：**

- 前端建议用 React + Tailwind，独立于 Claw 原有 Control UI
- 后端通过扩展 Gateway 的 WS API 暴露 Agent CRUD 接口
- Agent 配置持久化到 `~/.openclaw/agents/<agentId>/config.json`
- Sub-Agent 的关系存储在主 Agent 的 config 中，形成树形结构

---

### 需求 2：渠道接入 API 文档 + 多模态入参规范

**优先级：P0**

**需求说明：**

微信等渠道的接入已完成，但需要输出完整的 API 文档，明确各类消息（文本、图片、文件、视频、语音）的入参格式，供 MCP 侧和其他开发者对接。

**需要覆盖的内容：**

1. **统一消息格式定义：**
   - 文本消息：`{ type: "text", content: string }`
   - 图片消息：`{ type: "image", url: string, base64?: string, mimeType: string }`
   - 文件消息：`{ type: "file", url: string, filename: string, mimeType: string, size: number }`
   - 视频消息：`{ type: "video", url: string, duration?: number, thumbnail?: string }`
   - 语音消息：`{ type: "audio", url: string, duration: number, format: string }`
   - 位置消息：`{ type: "location", latitude: number, longitude: number, label?: string }`
   - 复合消息：`{ type: "composite", parts: Message[] }`

2. **渠道适配映射表：**
   - 微信 → 统一格式的字段映射
   - 钉钉 → 统一格式的字段映射
   - 飞书 → 统一格式的字段映射
   - 其他渠道同理

3. **回复/推送消息的格式：**
   - Agent 回复支持哪些类型
   - 主动推送的 API 规范

**实现思路：**

- 在 Channel Adapter 层做统一归一化
- 文件类的消息统一先下载到本地 workspace，再传路径给 Agent
- 输出 OpenAPI / Swagger 格式文档
- 大文件考虑流式传输和临时存储策略

---

### 需求 3：分层记忆体系

**优先级：P0**

**需求说明：**

在 Claw 原有记忆系统之上，增加 Sub-Agent 私有记忆和 Agent 间共享记忆，这对企业级多智能体协作至关重要。

**记忆分层设计：**

```
┌─────────────────────────────────────────────┐
│                 记忆层架构                     │
│                                               │
│  Layer 1: 全局共享记忆                         │
│  ├── 所有 Agent 可读                           │
│  ├── 企业级知识、全局配置                       │
│  └── 存储：Claw 原生 AGENTS.md + USER.md       │
│                                               │
│  Layer 2: 任务组共享记忆                        │
│  ├── 同一任务的主 Agent + Sub-Agent 共享        │
│  ├── 任务上下文、中间结果、协作信息              │
│  └── 存储：shared_memory:<task_id> namespace   │
│                                               │
│  Layer 3: Agent 私有记忆                       │
│  ├── 单个 Agent 独占                           │
│  ├── 该 Agent 的经验、偏好、专属知识             │
│  └── 存储：agent_memory:<agent_id> namespace   │
│                                               │
│  Layer 4: 会话记忆                             │
│  ├── 单次会话内的上下文                         │
│  └── 存储：Claw 原生 session JSONL             │
└─────────────────────────────────────────────┘
```

**核心功能：**

1. **Namespace 隔离机制：**
   - 每个 Agent 的私有记忆存储在独立 namespace 下
   - 任务组共享记忆以 task_id 为 namespace
   - 支持配置 Agent 对各 namespace 的读/写权限

2. **记忆读写 API：**
   - `memory_read(namespace, query)` — 在指定 namespace 中检索
   - `memory_write(namespace, content)` — 向指定 namespace 写入
   - `memory_share(from_namespace, to_namespace, content)` — 跨 namespace 共享
   - 这些应作为 Agent 可用的内置 Tool 暴露

3. **记忆同步和一致性：**
   - 共享记忆的写入需要考虑并发（多个 Sub-Agent 同时写）
   - 建议用 append-only + 时间戳，读取时按时间排序
   - 避免复杂的锁机制，保持简单

4. **记忆清理策略：**
   - 任务结束后，任务组共享记忆可配置为保留/归档/删除
   - Agent 下线后，私有记忆可配置为保留（供同类 Agent 继承）或删除

**实现思路：**

- 在 Claw 原有 Memory 模块基础上扩展 namespace 概念
- 底层存储仍用 SQLite + 向量索引，增加 namespace 字段
- 共享记忆的混合搜索复用 Claw 原有的 Vector + BM25 机制
- Session 级记忆保持 Claw 原有逻辑不动

---

### 需求 4：主 Agent 调度机制

**优先级：P0**

**需求说明：**

主 Agent 作为调度者，负责复杂任务的拆解、分发和结果汇总。Sub-Agent 之间可通过共享记忆交换信息。

**核心功能：**

1. **任务拆解和分发：**
   - 主 Agent 接收复杂任务后，拆解为子任务
   - 按 Sub-Agent 的 Skill 能力匹配分发
   - 支持串行（A 完成后 B 才开始）和并行（A、B 同时执行）
   - 支持条件分支（A 的结果决定走 B 还是 C）

2. **Sub-Agent 执行和回报：**
   - Sub-Agent 完成子任务后，将结果写入共享记忆
   - 主 Agent 可轮询或被通知子任务完成
   - 支持超时处理（Sub-Agent 超时未响应，主 Agent 重试或跳过）

3. **结果汇总：**
   - 主 Agent 从共享记忆中读取所有 Sub-Agent 的执行结果
   - 汇总后生成最终回复

4. **调度策略配置：**
   - 并发上限（同时运行的 Sub-Agent 数量）
   - 超时时间
   - 重试策略
   - 失败处理（继续 / 终止整个任务）

**实现思路：**

- 扩展 Claw 现有的 Subagent 机制
- 任务状态机：`pending → running → completed / failed / timeout`
- 任务元信息存储在主 Agent 的 session 中
- Sub-Agent 的执行通过 Claw 现有的 Lane Queue 调度，保持串行安全
- 并行任务开多个 Lane

---

### 需求 5：MCP Hub 连接界面（Tool 注册机制）

**优先级：P0**

**需求说明：**

前端需要一个界面与 MCP Hub 交互，实现 Tool 的发现、注册、管理和权限分配。

**核心功能：**

1. **Tool 注册和发现：**
   - 展示 MCP Hub 中所有已注册的 Tool 列表
   - 每个 Tool 显示：名称、描述、入参 schema、所属 MCP Server
   - 支持按类别筛选（ERP、CRM、知识库、通信、文件等）

2. **Tool 与 Agent 的绑定：**
   - 为每个 Agent / Sub-Agent 配置可用的 Tool 白名单
   - 支持 Tool 组（比如"财务工具组"包含 5 个 Tool，一键绑定）
   - 绑定关系持久化到 Agent config

3. **Tool 测试：**
   - 界面上可直接调用某个 Tool，查看返回结果
   - 用于验证 MCP 连接是否正常

4. **连接状态监控：**
   - MCP Hub 的连接状态（在线/离线）
   - 各 MCP Server 的健康状态

**实现思路：**

- Claw Gateway 增加一个 MCP Hub Client，通过 MCP 协议与本地 MCP Hub 通信
- 前端通过 Gateway WS API 获取 Tool 列表和状态
- Tool 绑定信息存储在 Agent config 中
- MCP Hub 侧会提供 `tools/list`、`tools/call` 等标准 MCP 接口，Claw 侧对接即可

---

### 需求 6：模型注册制

**优先级：P0**

**需求说明：**

参考 Dify / HiAgent 的模型管理方式，将模型管理做成注册制，支持为主 Agent 和 Sub-Agent 分别配置不同模型。

**核心功能：**

1. **模型注册：**
   - 支持注册多个 Provider（Anthropic、OpenAI、DeepSeek、本地 Ollama 等）
   - 每个 Provider 下注册具体模型（claude-sonnet-4-20250514、gpt-4o、deepseek-v3 等）
   - 配置 API Key、Base URL、并发限制、token 上限

2. **模型分配：**
   - 主 Agent 可配置主模型 + 备用模型（fallback）
   - Sub-Agent 可配置独立模型（比如简单任务用便宜模型）
   - Heartbeat 等低优任务可指定轻量模型

3. **模型切换和 Fallback：**
   - 保留 Claw 原有的 Provider 轮换和指数退避机制
   - 增加按 Agent 粒度的模型路由

4. **用量统计（对接需求 8）：**
   - 按模型、按 Agent 统计 token 消耗
   - 为成本管理提供数据基础

**实现思路：**

- 扩展 Claw 现有的 `agents.defaults.model` 和 `agents.defaults.models` 配置
- 新增前端模型管理页面
- 模型注册信息统一存储在 `~/.openclaw/models.json` 或数据库中
- Agent config 中引用模型 ID，运行时由 Model Resolver 解析

---

### 需求 7：可观测性和日志审计面板

**优先级：P0**

**需求说明：**

企业客户需要看到智能体做了什么、调了哪个 Tool、花了多少 token、有没有出错。没有这个能力，企业不敢上生产环境。

**核心功能：**

1. **执行链路追踪（Trace View）：**
   - 每个任务的完整执行链路可视化
   - 显示：用户输入 → 主 Agent 思考 → 任务拆解 → Sub-Agent 调用 → Tool 调用 → 返回结果
   - 每一步显示耗时、token 消耗、模型选择

2. **Tool 调用日志：**
   - 记录所有 MCP Tool 调用：Tool 名称、入参、出参、耗时、状态
   - 敏感参数脱敏处理

3. **异常和告警：**
   - Tool 调用失败告警
   - Agent 超时告警
   - 模型调用错误告警
   - 支持配置告警通知渠道

4. **筛选和检索：**
   - 按时间范围、Agent、任务类型、状态筛选
   - 关键词搜索日志内容

**实现思路：**

- 基于 Claw 原有的 JSONL Transcript 扩展，增加结构化字段
- 每条日志增加：`agent_id`、`task_id`、`tool_name`、`token_count`、`duration_ms`、`status`
- 前端做一个独立的 Dashboard 页面，支持时间线视图和列表视图
- 日志存储建议用 SQLite（轻量）或可选对接外部（如 ClickHouse）

---

### ■ 第二批：企业试用前必须完成

---

### 需求 8：Token 成本和用量管理

**优先级：P1**

**需求说明：**

企业最怕"不知道花了多少钱"。需要按多个维度统计 token 消耗和成本。

**核心功能：**

1. 按 Agent、按 Skill、按用户、按模型维度的 token 消耗统计
2. 成本预警和限额设置（某个 Agent 每天/每月不超过 N token）
3. 达到限额后的策略：告警 / 降级到便宜模型 / 停止执行
4. 成本趋势图表（日/周/月）

**实现思路：**

- 在 Agent Runtime 的模型调用层埋点，记录每次调用的 input/output token 数
- 成本计算基于模型注册时配置的单价
- 数据存储在 SQLite，前端展示为 Dashboard

---

### 需求 9：Skill 讨论和生成界面

**优先级：P1**

**需求说明：**

Skill 是业务逻辑的载体，需要一个可视化界面来创建、编辑、调试和复用 Skill。

**核心功能：**

1. **Skill 编辑器：**
   - Markdown 编辑器（Skill 本身是 Markdown 格式）
   - 语法高亮、模板提示
   - 支持声明该 Skill 依赖的 MCP Tool（从 MCP Hub 拉取可选列表）
   - 支持声明该 Skill 依赖的知识库

2. **Skill 调试：**
   - 单步执行模式：查看 Skill 每一步的 prompt 组装、模型响应、Tool 调用
   - Mock 模式：不真正调用 MCP Tool，用模拟数据返回
   - 对话回放：用历史对话重跑 Skill，对比输出差异

3. **Skill 市场/模板库：**
   - 内置常用 Skill 模板（客服、数据查询、报告生成等）
   - 支持导入/导出 Skill
   - 团队内 Skill 共享

4. **Skill 与 Agent 的绑定管理**

**实现思路：**

- Skill 文件格式保持 Claw 原生 Markdown 格式兼容
- 编辑器前端可基于 Monaco Editor 或 CodeMirror
- 调试模式通过在 Agent Runtime 中增加 debug 标志实现

---

### 需求 10：知识库管理界面

**优先级：P1**

**需求说明：**

我们的知识库分两层：

- **重型知识层（SGA-RAG）：** 企业文档、知识图谱，通过 MCP 接入
- **轻型知识层（Claw 记忆）：** 对话上下文、Agent 经验，Claw 原生

Claw 侧需要的前端界面：

**核心功能：**

1. **SGA-RAG 管理入口（通过 MCP 调用）：**
   - 查看 SGA-RAG 中的知识库列表（collection 列表）
   - 上传文档到指定 collection（调用 MCP Tool `sga_rag.upload`）
   - 查看文档解析状态
   - 测试检索（输入 query，查看返回结果）

2. **Claw 轻型知识管理：**
   - 查看 Claw 记忆文件列表
   - 手动编辑记忆文件
   - 查看记忆索引状态
   - 手动触发重建索引

3. **知识库与 Agent 的绑定：**
   - 配置每个 Agent 可访问哪些 SGA-RAG collection
   - 配置每个 Agent 的 Claw 记忆 namespace 访问权限

4. **知识路由策略：**
   - Agent 级别配置默认知识源（SGA-RAG / Claw 记忆 / 两者皆有）
   - Skill 级别可覆盖知识源配置

5. **知识回流机制：**
   - 对话中产生的有价值信息可从 Claw 记忆提升到 SGA-RAG
   - 支持人工触发（界面上标记"沉淀到知识库"）
   - 支持 Agent 自动触发（调用 MCP Tool `sga_rag.promote`）

**实现思路：**

- SGA-RAG 的管理操作全部通过 MCP Tool 调用，Claw 侧只做 UI
- Claw 记忆管理复用现有 memory 模块的 API
- 前端统一为一个"知识库"标签页

---

### 需求 11：多租户和权限体系

**优先级：P1**

**需求说明：**

平台层需要基础的权限管理，独立于 MCP Hub 的系统鉴权。

**核心功能：**

1. **用户角色：**
   - 管理员：全部权限
   - 开发者：创建/编辑 Agent、Skill，不能管理模型和系统配置
   - 使用者：只能与已授权的 Agent 对话
   - 审计员：只读查看日志和用量

2. **资源权限：**
   - 谁能创建 Agent
   - 谁能编辑哪些 Skill
   - 谁能访问哪些知识库
   - 部门之间的 Agent 和记忆隔离

3. **审批流（可选，P2）：**
   - 新建能访问敏感系统的 Agent 需要审批

**实现思路：**

- 简单的 RBAC 模型，存储在 SQLite
- 首版不需要太复杂，角色 + 资源白名单即可
- 后续可对接企业 LDAP / SSO

---

### 需求 12：Webhook / 事件触发机制

**优先级：P1**

**需求说明：**

企业工作流不都是"人发消息触发"的，很多是系统事件触发。

**核心功能：**

1. **Webhook 入口：**
   - 提供 HTTP Webhook 端点，企业系统可推送事件
   - 事件格式标准化：`{ event_type, payload, source, timestamp }`

2. **事件路由：**
   - 按 event_type 路由到指定 Agent
   - 支持配置规则引擎（简单的 if-then 匹配）

3. **定时触发：**
   - 扩展 Claw 的 Heartbeat / Cron 机制
   - 支持 Cron 表达式配置
   - 支持为不同 Agent 配置不同定时任务

4. **事件日志：**
   - 所有 Webhook 和定时触发的事件记录在日志中

**实现思路：**

- 在 Gateway 上增加 HTTP 端点接收 Webhook
- 事件进入 Claw 的 Lane Queue 排队处理
- Cron 任务复用 Claw 现有的 heartbeat 调度器扩展

---

### ■ 第三批：规模化后需要

---

### 需求 13：Agent 生命周期管理

**优先级：P2**

**核心功能：**

1. **版本管理：** Skill 和 Agent 配置支持版本号，可回滚
2. **灰度发布：** 新版 Agent 先给部分用户用，无问题再全量
3. **停用/归档：** Agent 下线时干净地停止所有 session，记忆可选保留
4. **克隆/模板化：** 一键复制 Agent 配置，修改后创建新 Agent

---

### 需求 14：测试 / 沙盒环境

**优先级：P2**

**核心功能：**

1. **沙盒模式：** Agent 在沙盒中运行，Tool 调用走 Mock，不影响生产
2. **Skill 单步调试：** 逐步执行 Skill，查看每步的 prompt 和 Tool 调用
3. **Mock MCP Tool：** 模拟 ERP/CRM 返回，不连真实系统
4. **对话回放/Eval：** 用历史对话重跑新版 Skill，对比输出差异

**实现思路：**

- 利用 Claw 现有的 sandbox 机制扩展
- Mock Tool 可在 MCP Hub 侧提供 mock 模式，也可在 Claw 侧拦截

---

### 需求 15：任务队列面板

**优先级：P2**

**核心功能：**

1. **任务可视化：** 队列中所有任务的状态（排队中/执行中/已完成/失败）
2. **优先级调整：** 手动调整任务优先级
3. **超时和重试配置**
4. **长任务进度反馈：** 批量任务（如处理 1000 条订单）显示进度

---

## 三、与 MCP Hub 的接口约定（需双方对齐）

Claw 侧和 MCP Hub 侧需要对齐以下接口：

| 接口 | 方向 | 说明 |
|------|------|------|
| `tools/list` | Claw → MCP Hub | 获取所有已注册 Tool 的列表和 schema |
| `tools/call` | Claw → MCP Hub | 调用指定 Tool |
| `tools/status` | Claw → MCP Hub | 查询 MCP Server 健康状态 |
| SGA-RAG 系列 Tool | Claw → MCP Hub → SGA-RAG | `sga_rag.search` / `upload` / `graph_query` / `promote` 等 |
| 鉴权 | MCP Hub 内部 | 系统鉴权（ERP/CRM 登录态）在 MCP Hub 内完成，Claw 侧不感知 |

**接口协议：** MCP 标准协议（JSON-RPC over stdio/HTTP）

---

## 四、优先级和里程碑建议

| 阶段 | 内容 | 目标 |
|------|------|------|
| **M1（4周）** | 需求 1-6 + 需求 7 的基础版 | 内部可跑通完整链路 |
| **M2（4周）** | 需求 8-12 | 可给企业客户试用 |
| **M3（持续）** | 需求 13-15 + 迭代优化 | 生产级稳定运行 |

---

## 五、开放问题（待讨论）

1. **是否 Fork OpenClaw？** 建议先在 OpenClaw 之上做扩展（插件 + 外挂模块），避免 Fork 带来的维护负担。如果改动过大再考虑 Fork。
2. **前端技术选型？** 建议独立前端项目，不耦合 Claw 原有 Control UI。
3. **数据存储升级？** 当前 SQLite 够用，但如果企业数据量大，后续可能需要 PostgreSQL。
4. **SGA-Molt 是否开源？** 商业策略需要讨论。

---

*以上为 Claw 侧全部需求，MCP Hub 侧需求文档另出。有任何问题随时沟通。*
