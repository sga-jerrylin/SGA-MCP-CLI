# API 接口计划：MCP Hub（管理面 + MCP 对外）

版本：v0.1（草案）  
日期：2026-02-09  

---

## 0. 目的与范围

本文件定义两类接口：

- A) **管理面 REST API（Control Plane）**：供平台前端控制台调用，用于租户/连接器/工具/工具包/生成器/审计等管理能力。
- B) **MCP 对外接口（Data Plane）**：供 OpenClaw 等作为 MCP Client 使用（tools/list、tools/call 语义），用于运行时工具发现与执行。

同时定义关键字段、错误码、版本策略与最小安全约束，确保研发/测试/交付可对齐。

---

## 1. 通用约定（管理面 REST API）

### 1.1 Base URL

- 管理面：`/api`
- 版本号：MVP 可不显式写版本（后续可升级为 `/api/v1`）

### 1.2 认证

MVP：
- `Authorization: Bearer <accessToken>`

后续：
- SSO/LDAP/OIDC 可作为可插拔实现。

### 1.3 通用响应格式（Envelope）

成功：
```json
{
  "requestId": "uuid",
  "success": true,
  "data": {},
  "error": null
}
```

失败：
```json
{
  "requestId": "uuid",
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {}
  }
}
```

### 1.4 错误码（管理面）

- `UNAUTHORIZED`：未登录/Token 过期
- `FORBIDDEN`：无权限
- `VALIDATION_ERROR`：参数校验失败
- `NOT_FOUND`：资源不存在
- `CONFLICT`：版本冲突/重复名称
- `INTERNAL_ERROR`：服务器内部错误

### 1.5 多租户路径规则

多租户模式：
- `/api/tenants/{tenantId}/...`

单租户模式：
- 可省略 tenants 段：`/api/...`
- 后端固定 tenantId 为部署配置中的默认租户。

本计划以多租户路径示例为主，单租户可通过路由别名兼容。

---

## 2. 管理面 API（Control Plane）

### 2.1 认证与用户

#### POST /api/auth/login
入参：
```json
{ "username": "admin", "password": "******" }
```
出参：
```json
{
  "accessToken": "jwt",
  "expiresAt": "2026-02-09T00:00:00Z",
  "user": { "id": "u_1", "name": "Admin", "roles": ["admin"] }
}
```

#### GET /api/me
出参：当前用户信息与角色。

---

### 2.2 租户（可选：多租户部署才启用）

#### GET /api/tenants
出参：租户列表（分页可后续）。

#### POST /api/tenants
入参：
```json
{ "name": "客户A", "status": "active" }
```
出参：tenant 对象。

#### PATCH /api/tenants/{tenantId}
入参：允许修改 name/status。

---

### 2.3 连接器类型（系统级只读）

#### GET /api/connector-types
出参示例：
```json
[
  {
    "id": "internal_ecosystem",
    "name": "Internal Ecosystem",
    "version": "1.0.0",
    "capabilities": {
      "protocols": ["http"],
      "authModes": ["apiKey", "hmac", "oauth2", "mtls"],
      "paginationModes": ["pageSize", "offsetLimit", "cursor", "nextLink"]
    }
  }
]
```

---

### 2.4 连接器实例（租户级）

#### GET /api/tenants/{tenantId}/connector-instances
出参：实例列表。

#### POST /api/tenants/{tenantId}/connector-instances
入参（示意，具体字段随 connectorType 改变）：
```json
{
  "name": "客户A-金蝶",
  "connectorTypeId": "kingdee",
  "baseUrl": "https://kingdee.internal",
  "auth": { "mode": "hmac", "config": { "appId": "xxx", "secretRef": "sec_123" } },
  "network": { "proxy": null, "timeoutMs": 15000 },
  "tls": { "mtlsEnabled": false, "caRef": null, "clientCertRef": null }
}
```
出参：实例对象（不返回敏感明文）。

#### GET /api/tenants/{tenantId}/connector-instances/{instanceId}
出参：实例详情（敏感字段以引用/掩码表示）。

#### PATCH /api/tenants/{tenantId}/connector-instances/{instanceId}
入参：允许更新 baseUrl/network/tls/auth（密钥引用）。

#### POST /api/tenants/{tenantId}/connector-instances/{instanceId}/test-connection
出参：
```json
{ "ok": true, "latencyMs": 120, "upstreamInfo": { "version": "x.y" } }
```
失败：
```json
{ "ok": false, "latencyMs": 0, "error": { "code": "UPSTREAM_AUTH_FAILED", "message": "..." } }
```

---

### 2.5 Tool（工具）与分类管理

#### GET /api/tenants/{tenantId}/domains
返回：业务域分类列表（例如：`[{id: "finance", name: "财务域", toolCount: 15}]`）。

#### POST /api/tenants/{tenantId}/domains
入参：`{ "name": "CRM域", "key": "crm" }`
用途：新建业务分类，用于工具归组与分片。

#### DELETE /api/tenants/{tenantId}/domains/{domainId}
用途：删除分类（需检查是否有关联工具）。

#### GET /api/tenants/{tenantId}/tools
Query：
- `status`: `draft | active`
- `domainId`: 按分类过滤
- `packageVersionId`: 可选

返回：工具列表（可按 toolName、displayName 过滤，后续补充）。

#### POST /api/tenants/{tenantId}/tools
用途：手工创建草案或导入生成器产物。

入参（示意）：
```json
{
  "toolName": "inventory_getStock",
  "displayName": "查询库存",
  "domainId": "scm",
  "description": "按SKU与仓库查询可用库存",
  "connectorInstanceId": "ci_1",
  "inputSchema": { "type": "object", "properties": { "sku": { "type": "string" } }, "required": ["sku"] },
  "outputSchema": { "type": "object", "properties": { "available": { "type": "number" } }, "required": ["available"] },
  "examples": [{ "input": { "sku": "ABC" }, "output": { "available": 10 } }],
  "mappingRules": { "request": {}, "response": {}, "errors": {} }
}
```

#### GET /api/tenants/{tenantId}/tools/{toolId}
返回：工具详情（包含 schema、映射规则、示例）。

#### PATCH /api/tenants/{tenantId}/tools/{toolId}
可更新：
- displayName/description
- domainId (移动分类)
- inputSchema/outputSchema/examples
- mappingRules
- connectorInstanceId

限制建议：
- toolName 创建后默认不可改（或需要“重命名迁移”流程），避免对外 breaking change。

#### POST /api/tenants/{tenantId}/tools/{toolId}/validate
行为：静态校验（schema 合法性、映射规则合法性），可选执行连通性测试。

返回：
```json
{ "ok": true, "issues": [] }
```
或：
```json
{ "ok": false, "issues": [{ "level": "error", "path": "inputSchema", "message": "..." }] }
```

---

### 2.6 工具包与版本发布

#### GET /api/tenants/{tenantId}/packages
返回：工具包列表。

#### POST /api/tenants/{tenantId}/packages
入参：
```json
{ "name": "internal-standard", "description": "内部生态标准工具包" }
```

#### GET /api/tenants/{tenantId}/packages/{packageId}/versions
返回：版本列表（含 status、createdAt、publishedAt）。

#### POST /api/tenants/{tenantId}/packages/{packageId}/versions
用途：从当前 draft 工具集合创建版本。

入参：
```json
{ "version": "1.0.0", "toolIds": ["t1", "t2"], "notes": "首次发布" }
```

#### POST /api/tenants/{tenantId}/packages/{packageId}/versions/{versionId}/smoke-test
用途：执行该版本的 smoke test（测试用例来自工具或生成器产物）。

出参：
```json
{ "ok": true, "report": { "passed": 10, "failed": 0, "durationMs": 12345 } }
```

#### POST /api/tenants/{tenantId}/packages/{packageId}/versions/{versionId}/publish
用途：发布该版本为 active。

入参（MVP 可只支持全量）：
```json
{ "mode": "full" }
```

#### POST /api/tenants/{tenantId}/packages/{packageId}/versions/{versionId}/rollback
用途：回滚到某个已发布版本。

入参：
```json
{ "targetVersionId": "pv_123" }
```

---

### 2.7 调试执行（供前端“试运行”）

#### POST /api/tenants/{tenantId}/debug/execute-tool
入参：
```json
{ "toolName": "inventory_getStock", "input": { "sku": "ABC" } }
```
出参：
```json
{
  "traceId": "tr_123",
  "ok": true,
  "result": { "available": 10 },
  "normalizedError": null
}
```
失败：
```json
{
  "traceId": "tr_123",
  "ok": false,
  "result": null,
  "normalizedError": { "class": "Upstream", "code": "KINGDEE_401", "message": "Auth failed", "retryable": false }
}
```

---

### 2.8 审计与监控

#### GET /api/tenants/{tenantId}/audits
Query：
- `from` / `to`
- `toolName`
- `status`：success/failure
- `traceId`

返回：审计列表（分页后续）。

#### GET /api/tenants/{tenantId}/audits/{traceId}
返回：单次调用的详情（脱敏后的 request/response digest、耗时、重试、错误归因）。

#### GET /api/tenants/{tenantId}/metrics/summary
返回：成功率、P95、上游错误率等聚合指标。

---

### 2.9 生成器（OpenAPI 导入与草案应用）

#### POST /api/tenants/{tenantId}/generator/import-openapi
入参（两种方式二选一）：
```json
{ "openapiText": "..." }
```
或
```json
{ "openapiFileRef": "obj_123" }
```
出参：
```json
{ "jobId": "gj_1" }
```

#### GET /api/tenants/{tenantId}/generator/jobs/{jobId}
返回：状态、日志、产物摘要（工具草案清单、schema diff、建议映射）。

#### POST /api/tenants/{tenantId}/generator/jobs/{jobId}/apply
用途：将产物应用到草案工具库（draft）。

入参：
```json
{ "mode": "merge", "conflictPolicy": "keepExisting" }
```

---

## 3. MCP 对外接口（Data Plane）

### 3.1 接口语义与最小集合

必须支持：
- `tools/list`
- `tools/call`

可选支持（后续）：
- resources/list、resources/read（用于暴露只读资源，如工具文档、字段字典）
- prompts/list、prompts/get（用于分发提示模板）

### 3.2 传输方式规划

为适配私有化多种部署，规划两类：

- Transport 1：**stdio**（同机/同容器最简单）
  - 适用：OpenClaw 与 MCP Hub 运行在同台机器或同容器编排中
  - 特点：安全边界清晰，不额外暴露端口

- Transport 2：**HTTP**（跨机器/跨容器）
  - 适用：企业要求分网络区部署、或 MCP Hub 作为集中服务
  - 实现细节（SSE/WebSocket/长轮询）以最终采用的 MCP HTTP 传输实现为准

本接口计划只固定“tools/list 与 tools/call 的语义与数据结构”，传输细节属于实现选型。

### 3.3 tools/list 输出要求（规范）

输出必须包含（每个工具）：
- `name`：toolName（稳定标识）
- `description`
- `inputSchema`

过滤规则：
- 仅返回当前发布版本（active）的工具
- 受 allowlist/policy 约束

### 3.4 tools/call 输入输出要求（规范）

输入：
- `name`：toolName
- `arguments`：JSON object

执行要求：
- 输入 schema 校验：失败必须返回可机读错误（Validation）
- 策略执行：限流/超时/重试/断路器/脱敏
- 必须生成并返回 `traceId`

输出（建议统一 envelope，便于上层处理）：

成功：
```json
{
  "traceId": "tr_123",
  "ok": true,
  "content": [{ "type": "json", "json": { "available": 10 } }],
  "error": null
}
```

失败：
```json
{
  "traceId": "tr_123",
  "ok": false,
  "content": [],
  "error": {
    "class": "Validation",
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "sku is required",
    "retryable": false
  }
}
```

错误分类建议：
- `Auth`
- `Validation`
- `RateLimit`
- `Upstream`
- `Timeout`
- `Internal`

### 3.5 版本兼容策略（对外约束）

为降低上层 skill 与客户端的维护成本，建议定义工具兼容规则：

- toolName 稳定：同名工具的输入 schema 不做 breaking change（除非发新 toolName 或主版本迁移机制）
- schema 兼容：
  - 允许新增可选字段
  - 禁止删除字段/改变字段类型/改变必填集合（breaking）
- 输出兼容：
  - 允许新增字段
  - 禁止移除已有字段（breaking）

### 3.6 对外 Agent 接入：工具目录（Catalog）与自动 Skill 生成

目标：当外部 Agent（例如 OpenClaw）连接到你们提供的 MCP Server 时，它能“读取工具信息 → 由它自己生成/编写 skill”。

约束：MCP 的 `tools/list` 能提供基本工具列表与输入 schema，但对“自动写 skill”来说，通常还需要更多元数据（分类、业务意图、示例、字段字典、注意事项、错误处理建议、幂等语义等）。这些元数据不宜全部塞进 `description`，否则会引起上下文过长与工具过载问题。

因此建议提供一个“工具目录（Catalog）”能力，用于给 Agent 拉取更完整、结构化、可检索的工具信息：

#### 方案 A（推荐）：通过 MCP resources 暴露 Catalog（可选能力）

- `resources/list`：列出可用资源，例如：
  - `mcp://catalog/tools`（工具目录）
  - `mcp://catalog/groups`（分类/分片信息）
  - `mcp://catalog/dicts/{name}`（字段/枚举字典）
- `resources/read`：读取上述资源，返回结构化 JSON 内容

建议 `mcp://catalog/tools` 内容（示意）：
```json
{
  "generatedAt": "2026-02-09T00:00:00Z",
  "packageVersion": "1.2.0",
  "tools": [
    {
      "name": "inventory_getStock",
      "displayName": "查询库存",
      "group": "inventory",
      "intent": "查询指定SKU在仓库的可用库存",
      "inputSchemaRef": "inline",
      "outputSchemaRef": "inline",
      "examples": [
        { "input": { "sku": "ABC" }, "output": { "available": 10 } }
      ],
      "notes": [
        "sku 支持逗号分隔批量查询（最多50）",
        "返回 available 为可用量，不含在途量"
      ],
      "idempotency": { "required": false }
    }
  ]
}
```

#### 方案 B：管理面提供只读 Catalog API（便于非 MCP 客户端使用）

当外部 Agent 不能或不方便读取 MCP resources 时，可提供只读 HTTP 接口给它拉取 Catalog：

- GET `/api/tenants/{tenantId}/public/tool-catalog`
  - 用途：外部 Agent/集成系统读取工具目录与元数据，用于自动生成/维护 skill
  - 返回：同方案 A 的结构（工具、分组、版本、示例、注意事项、字段字典引用）

安全建议：
- 该接口应支持按部署策略启用/禁用。
- 若启用，建议通过 mTLS 或 Bearer token 保护，并做访问审计。

#### Agent 侧生成 skill 的建议流程（约定而非强制）

1) 读取工具目录（resources/read 或 tool-catalog API）
2) 根据任务意图挑选相关 group 与工具集合
3) 生成 skill：
   - 只引用必要工具（允许工具白名单/allowlist）
   - 写入关键业务约束与错误处理（重试条件、幂等键、分页）
4) 在联调环境执行 smoke test（工具试运行/或 Agent 自己调用）

### 3.7 工具分类、分片与多端口部署（解决上下文过长/工具过载）

问题：当一个 MCP Server 暴露过多 tools 时，客户端在工具发现、选择与编排时会面临“上下文过长/工具选择困难/成本升高”的过载问题。

建议将工具按业务域分组，并将每个分组部署为一个独立 MCP Server（容器/进程），监听不同端口：

- **Group（分组/分类）**：例如 `inventory`、`order`、`finance`、`crm`、`admin`
- **Shard（分片实例）**：每个 group 对应一个 MCP Server 实例（容器），只暴露该 group 的工具

交付形态建议：
- `mcp-inventory`：暴露库存相关 tools（端口 7101）
- `mcp-order`：暴露订单相关 tools（端口 7102）
- `mcp-finance`：暴露财务相关 tools（端口 7103）

对外提供一个“分片注册表（Shard Registry）”，让 Agent 先发现有哪些 MCP 端点，再选择连接某个端点进行 tools/list：

#### 方案 A：通过 Catalog groups 暴露端点信息（推荐）

- `mcp://catalog/groups`（通过 resources/read 返回）
```json
{
  "packageVersion": "1.2.0",
  "groups": [
    { "group": "inventory", "endpoint": "http://host:7101/mcp", "toolsCount": 28 },
    { "group": "order", "endpoint": "http://host:7102/mcp", "toolsCount": 35 }
  ]
}
```

#### 方案 B：管理面提供只读 endpoints API

- GET `/api/tenants/{tenantId}/public/mcp-endpoints`
```json
{
  "endpoints": [
    { "group": "inventory", "url": "http://host:7101/mcp" },
    { "group": "order", "url": "http://host:7102/mcp" }
  ]
}
```

分片规则建议：
- 每个分片工具数量建议控制在 30～80（与客户端能力相关，可配）
- 工具名加前缀并不等同于分片；分片的关键是“tools/list 的集合变小”
- cross-domain 操作尽量由上层 skill 编排多个 MCP 端点完成，不在单个 tool 内做隐式跨域调用（除非有强一致性需求）

### 3.8 Claude Code 的“工具过载”处理方式（可借鉴）

可借鉴的原则（不依赖 Claude Code 的具体实现细节）：

- **多 MCP Server 并存**：通过配置接入多个 MCP servers；当工具过多时拆分为多个服务器，减少单次暴露的工具集合。
- **按任务/Skill 限制可用工具**：在 skill 级别声明允许使用的工具集合（allowlist 思路），把“可用工具范围”缩小到完成任务所需最小集合。
- **工具描述克制**：把长说明从 tool description 中挪到可检索的资源（catalog/字典），避免把每个工具都写成“长提示词”。

将上述原则落到本平台：
- 通过 3.7 的分片部署控制 `tools/list` 规模
- 通过 3.6 的 Catalog 提供“长文档/字典/示例”，让 Agent 按需拉取，而不是全部塞进工具描述
- 通过租户策略（allowlist）与工具包版本控制，保证对外暴露集合稳定、可控

---

## 4. Connector Runtime 内部接口（插件协议）

用于 Data Plane 与 Connector Runtime 之间的内部协议（MVP 可 HTTP/JSON）。

### POST /connector/execute

入参：
```json
{
  "traceId": "tr_123",
  "connectorTypeId": "kingdee",
  "connectorInstanceId": "ci_1",
  "operation": "getStock",
  "input": { "sku": "ABC" },
  "mappingRules": { "request": {}, "response": {}, "errors": {} },
  "timeoutMs": 15000
}
```

出参（成功）：
```json
{
  "ok": true,
  "upstream": {
    "target": "https://kingdee.internal",
    "requestDigest": { "method": "GET", "path": "/stock", "query": { "sku": "ABC" } },
    "responseDigest": { "status": 200 }
  },
  "data": { "available": 10 },
  "normalizedError": null
}
```

出参（失败）：
```json
{
  "ok": false,
  "upstream": {
    "target": "https://kingdee.internal",
    "requestDigest": { "method": "GET", "path": "/stock", "query": { "sku": "ABC" } },
    "responseDigest": { "status": 401 }
  },
  "data": null,
  "normalizedError": { "class": "Auth", "code": "KINGDEE_401", "message": "Auth failed", "retryable": false }
}
```

---

## 5. 前端对接要点（与 API 的契约）

- JSON Schema 编辑与校验：
  - 前端保存 schema 前可做本地校验；后端 /validate 做最终校验
- 工具草案状态机：
  - draft（可编辑）→ 版本化（packageVersion）→ 发布（active）
- 发布门槛：
  - smoke test 未通过不得 publish
- 调试执行：
  - 调试接口返回 traceId，前端可跳转到审计详情页
