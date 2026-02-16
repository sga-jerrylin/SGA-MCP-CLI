# PRD：MCP Hub 企业工具接入与交付平台（私有化/本地化）

版本：v0.1（草案）  
作者：Trae（基于需求对话整理）  
日期：2026-02-09  

---

## 1. 背景与问题

企业在系统集成时存在“高差异、强合规、强运维”特征：

- 系统差异：ERP/业务系统种类多（用友/金蝶/自研/行业系统），接口风格、鉴权、分页、错误码都不同。
- 网络差异：内网访问、专线、代理、证书、双向 TLS（mTLS）等。
- 合规差异：审计留痕、脱敏、留存周期、可追溯性要求不同。
- 交付痛点：每企业单独做一套 MCP Server 会导致代码分叉、升级困难、治理能力不一致。
- 生态机会：公司内部生态 API 在多企业场景下相对一致，具备“标准连接器+标准工具包”的复用价值。

本 PRD 定义一个可私有化部署的“工具接入与治理平台”，对外提供 MCP 工具调用，对内提供连接器、配置、发布、审计、限流、可观测与生成器能力。

---

## 2. 产品定位

**MCP Hub**：企业私有化部署的工具接入与治理平台。

- 对外：标准 MCP Server（tools/list、tools/call），供 OpenClaw/Dify/HiAgent 等作为 MCP Client 调用。
- 对内：管理端（前端+后端 API），用于租户/连接器/工具/发布/审计/生成器管理。

核心策略：**稳定 Runtime + 多租户配置 + 可插拔 Connector + 工具包版本治理**。尽量把企业差异收敛到配置/映射/策略，而非代码分叉。

---

## 3. 目标与非目标

### 3.1 Goals

- G1：一套 Runtime 支持多企业差异，通过配置与插件实现接入。
- G2：沉淀“内部生态标准工具包”，实现跨企业快速交付。
- G3：提供“OpenAPI/文档 → 工具草案（schema/示例/映射/测试）”能力，减少人工重复劳动。
- G4：私有化部署可控：单企业独立部署为主，多企业隔离部署为可选形态。
- G5：统一治理：审计、脱敏、限流、超时、重试、断路器、回滚、监控告警。

### 3.2 Non-Goals

- 不替代上层编排系统（OpenClaw 等）做工作流/对话/技能编排。
- 不做全量数据同步/ETL 主数据平台。
- 不追求 100% 自动生成可上线工具；生成产物必须经过审核与测试门槛。

---

## 4. 用户画像与使用场景

### 4.1 用户画像（Personas）

- 平台管理员（你们公司）：管理连接器类型、策略模板、标准工具包版本。
- 交付工程师（你们公司）：为客户创建配置、导入文档、生成工具草案、联调、发布、回滚。
- 客户运维：部署、网络与证书配置、密钥轮换、审计策略设置、限流调整（受控）。
- 审计/安全人员：只读审计、导出报表、追踪某次调用链路。

### 4.2 典型场景（Use Cases）

- UC-1：客户 A 的金蝶接口接入：导入 OpenAPI → 生成工具草案 → 配置签名/证书 → 试运行 → 发布工具包 v1 → OpenClaw 调用。
- UC-2：客户 B 使用公司内部生态统一 API：选择“内部生态标准工具包”→ 填 baseUrl/凭证 → 一键发布。
- UC-3：线上问题追踪：通过 traceId 查询一次 tools/call 的审计记录（入参摘要脱敏、上游请求摘要、耗时、重试次数、错误归因）。
- UC-4：灰度/回滚：工具包 v2 发布后发现某工具行为变更，回滚到 v1 并记录变更审计。

---

## 5. 产品范围（模块划分）

### 5.1 Data Plane：MCP 执行面（对外）

职责：提供 MCP 工具发现与调用，并执行治理策略。

- tools/list：按当前发布版本与 allowlist 返回工具清单与输入 schema。
- tools/call：参数校验 → 策略（限流/超时/重试/脱敏）→ connector 调用 → 结果归一化 → 审计与指标 → 返回结果（含 traceId）。

### 5.2 Control Plane：管理面（对内）

职责：租户/连接器/工具/策略/发布/审计/生成器管理与可视化。

### 5.3 Connector Runtime：连接器插件体系

职责：适配不同系统的鉴权、分页、字段转换、错误码映射等，与 Data Plane 通过统一协议对接。

### 5.4 Generator：生成器（文档→工具草案）

职责：从 OpenAPI/文档中抽取工具定义草案、示例、字段映射与测试用例草案；支持人工审核与应用（apply）到工具草案库。

---

## 6. 关键对象模型（产品级）

- Tenant（租户/企业）
  - id、name、status、createdAt
  - deploymentMode：single-tenant / multi-tenant（产品形态差异）
- ConnectorType（连接器类型，系统级）
  - id、name、capabilities（authModes/paginationModes/protocols）、version
- ConnectorInstance（连接器实例，租户级）
  - id、tenantId、connectorTypeId、name、baseUrl、authConfig、networkConfig、tlsConfig、status
- Tool（工具，租户级）
  - id、tenantId、name（对外稳定标识）、displayName（业务名）、description、inputSchema、outputSchema、examples、mappingRules、connectorInstanceId、status（draft/active）
- ToolPackage（工具包，租户级）
  - id、tenantId、name
- ToolPackageVersion（工具包版本）
  - id、packageId、version、toolsSnapshot、status（draft/published/archived）、publishedAt
- Policy（策略，租户级）
  - rateLimit、timeout、retry、circuitBreaker、audit、masking、allowlist
- AuditLog（审计日志）
  - tenantId、traceId、toolName、connectorInstanceId、status、latencyMs、retryCount、requestDigest、responseDigest、errorClass、createdAt
- GeneratorJob（生成任务）
  - id、tenantId、inputRef、status、logs、artifactsRef、createdAt、finishedAt

---

## 7. 功能需求（Functional Requirements）

### 7.1 MCP 工具能力

- FR-1：支持 MCP 工具发现与调用语义：tools/list、tools/call。
- FR-2：tools/list 输出需按租户发布版本、allowlist、工具状态过滤。
- FR-3：tools/call 必须进行输入 schema 校验；校验失败返回可机读错误。
- FR-4：tools/call 输出必须包含 traceId；成功与失败都可追溯。
- FR-5：工具命名规则（强约束）：
  - toolName：稳定、机器可读、跨版本兼容（例如 `inventory_getStock`）
  - displayName：可变的业务展示名（例如 `查询库存`）

### 7.2 多租户与隔离

- FR-6：租户配置与密钥隔离；工具可见性隔离；审计隔离；限流隔离。
- FR-7：支持单租户部署（简化 UI 与租户管理），同一套代码可切换部署模式。

### 7.3 Connector 能力

- FR-8：鉴权支持（MVP 至少两种，后续扩展）：
  - API Key（header/query）
  - HMAC/签名（按 connectorType 实现）
  - OAuth2（V1）
  - mTLS（按企业需要，V1）
- FR-9：网络配置支持：代理、超时、DNS/hosts（可选）、证书链配置。
- FR-10：分页策略支持：page/size、offset/limit、cursor、nextLink。
- FR-11：错误归一化：上游错误码映射到统一错误分类（Auth/Validation/RateLimit/Upstream/Timeout）。

### 7.4 治理与可靠性

- FR-12：限流：按 tenant、tool、connectorInstance 三层叠加；支持突发与并发限制。
- FR-13：重试：只对幂等请求或携带幂等键的业务动作生效；指数退避。
- FR-14：断路器：按 connectorInstance 维度，防止雪崩。
- FR-15：审计：记录入参摘要（脱敏后）、上游目标、耗时、重试次数、状态与错误归因。
- FR-16：脱敏策略：按字段路径配置，可选择“不落盘”。

### 7.5 工具包与发布

- FR-17：工具包版本化：创建版本、发布、回滚；版本间差异可展示（schema diff/字段 diff）。
- FR-18：发布门槛：必须通过 smoke test（至少可配置 1-2 条主链路测试）。
- FR-19：灰度发布（可选）：按 client、按比例、按工具维度切换。

### 7.6 生成器（OpenAPI/文档→草案）

- FR-20：支持导入 OpenAPI（JSON/YAML），生成工具草案（name/description/schema/examples）。
- FR-21：支持生成字段映射草案与枚举映射草案，可在 UI 编辑。
- FR-22：生成测试用例草案（smoke test），可一键执行并输出报告。
- FR-23：生成产物需要人工审核后才能 apply 到草案库。
- FR-24：生成过程需要可追溯：输入版本、输出版本、模型版本、提示词版本（用于审计与复现）。

---

## 8. 前端设计（交付流水线与驾驶舱）

### 8.1 信息架构（IA）

采用“流水线（Pipeline）+ 驾驶舱（Dashboard）”架构，而非传统后台 CRUD。

- **系统概览（Dashboard）**
  - **拓扑视图**：ERP（源） → MCP Hub（Runtime + Shards） → Agent（目的）连通状态。
  - **实时监控**：QPS/延迟曲线、容器资源水位、最近告警列表。
  - **发布状态**：当前版本、待发布变更数、分片预览。

- **1. 连接与鉴权 (Source & Auth)**
  - 连接器实例列表（卡片式）。
  - **鉴权配置弹窗**：AK/SK、OAuth2、HMAC 表单与连通性测试。

- **2. 工具库 (Library)**
  - **业务分类管理**：新建/编辑业务域（Domain），工具按域归组。
  - 工具列表：草案/已发布状态、搜索、过滤。
  - **生成器入口**：导入 OpenAPI/文档 → 自动归类与生成草案。

- **3. 部署发布 (Deploy)**
  - **分片预览**：自动计算容器分片策略（Shard Plan）。
  - **发布执行**：提交变更 → 生成 Docker 配置 → 重建容器 → 健康检查（Terminal 日志流展示）。

- **4. 运维治理**
  - **运行监控**：实时指标与资源大盘。
  - **审计日志**：调用流水表 + 详情侧边栏（脱敏 JSON、时间轴）。

### 8.2 关键页面交互

1) **连接与鉴权页**
   - 核心动作：新建连接 → 填 BaseURL → 点击“钥匙”图标配置鉴权 → 测试连通性。
   - 反馈：即时展示测试结果（Latency / Error）。

2) **工具库页**
   - 左侧栏：业务域分类管理（支持拖拽或右键操作）。
   - 列表区：展示工具状态（Draft/Active），支持从 OpenAPI 导入并自动归入分类。

3) **部署发布页**
   - 核心动作：点击“提交并重建容器”。
   - 反馈：弹出 Terminal 窗口，实时展示部署流水线日志（Stop -> Build -> Start -> HealthCheck）。

4) **审计日志页**
   - 列表：TraceID、工具名、耗时、状态。
   - 详情（侧边栏）：
     - 基础 KV：状态、客户端、上游错误码。
     - 代码块：请求/响应 JSON（**字段级脱敏**）。
     - 时间轴：关键节点耗时（接收 -> 鉴权 -> 上游 -> 响应）。

---

## 9. 后端设计（服务边界与执行链路）

### 9.1 逻辑拆分（MVP 可合并部署）

- Control Plane API：提供管理面 REST API（见 03_API_Plan）
- Data Plane：对外 MCP 接入 + 执行链路 + 审计/指标
- Connector Runtime：连接器执行服务（可同进程或分进程；建议分进程）
- Generator Service：生成器服务（MVP 可与 Control Plane 合并）

### 9.2 tools/call 执行链路（文字时序）

1. 接收调用（解析 toolName + arguments）
2. 根据当前租户发布版本定位 tool 定义与绑定的 connectorInstance
3. 输入 schema 校验（失败直接返回可机读错误）
4. 策略加载（限流/超时/重试/断路器/脱敏）
5. 生成 traceId 与 traceContext
6. 调用 Connector Runtime（传入 operation + mappingRules + input）
7. 归一化输出/错误（规范化 errorClass、retryable）
8. 落审计（入参摘要脱敏、上游摘要、结果摘要、耗时）
9. 返回结果（带 traceId）

---

## 10. 对外接口（概述）

- 对外 MCP：tools/list、tools/call（语义与返回结构按 MCP 标准；传输支持 stdio / HTTP）
- 对内管理 API：租户/连接器/工具/工具包/生成器/审计（详见 03_API_Plan）

---

## 11. 非功能需求（NFR）

- 可用性：目标 99.9%（按客户环境可调整）
- 性能：平台额外开销 < 50ms（不含上游 API）
- 安全：密钥不落明文、字段级脱敏、最小权限、可审计
- 可运维：健康检查、指标、日志、告警接入
- 可扩展：新增系统类型主要通过新增 connectorType/插件与配置实现

---

## 12. 验收标准（Acceptance Criteria）

- AC-1：同一 Runtime 支持至少 2 个租户暴露不同工具集，且密钥/审计/限流隔离。
- AC-2：内部生态标准工具包接入：仅配置 endpoint+凭证，30 分钟内可发布并被 MCP Client 调用成功。
- AC-3：每次 tools/call 返回 traceId，审计页可定位到完整记录（含脱敏入参摘要与错误归因）。
- AC-4：OpenAPI 导入后生成 ≥80% schema 草案；人工审核+smoke test 通过后可发布。

---

## 13. 里程碑建议

- M0（1-2 周）：Data Plane 最小闭环（tools/list/call + 审计落盘 + 1 个 connector stub）
- MVP（4-6 周）：单租户 + 2 种鉴权 + 工具包发布回滚 + 基础 UI + OpenAPI 导入草案
- V1（8-12 周）：多租户 + 配置版本化 + OAuth2 + 灰度 + 指标与告警完善

