# skill CLI ↔ Hub 接口文档

> 版本: v1.1 | 日期: 2026-02-22
> v1.1 变更：CLI 命令统一为 `skill` 命令集；`hubSseUrl` 归入 `inputs` 机制；config 路径对齐 `~/.skillcli/`

## 概述

`skill generate` 是 Workflow Skill 生成子命令。它需要从 Hub 获取已安装的 MCP 工具清单，
基于真实工具信息编排 Skill（高层工作流），再将生成的 Skill 发布到 Skill Market。

```
skill CLI（workflow 生成路径）
  │
  ├─ 1. 查询 Hub 工具目录 ──────────→ GET /api/repo/tools/catalog
  │       拿到真实工具名 + inputSchema
  │
  ├─ 2. 基于工具编排 Skill 工作流
  │       (skill generate 内部完成，LLM 编排 steps)
  │
  └─ 3. 发布 Skill 到 Market ────────→ POST /api/packages/sync/push (Market API)
```

---

## 接口 1：获取 Hub 工具目录

这是 skill-claw-cli **最核心**的接口，用于了解 Hub 有哪些真实工具可以编排。

### 请求

```
GET /api/repo/tools/catalog
```

**认证**（可选，未来版本加）：

```
Authorization: Bearer <hub-token>
```

### 响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "totalTools": 25,
    "packages": [
      {
        "packageId": "kingdee-erp-1-0-0",
        "packageName": "金蝶 ERP",
        "tools": [
          {
            "toolName": "kingdee-erp-1-0-0.getStock",
            "description": "按SKU查询指定仓库的实时可用库存数量",
            "inputSchema": {
              "type": "object",
              "properties": {
                "sku": { "type": "string", "description": "产品SKU编码" },
                "warehouseId": { "type": "string", "description": "仓库ID，留空查全部仓库" }
              },
              "required": ["sku"]
            }
          },
          {
            "toolName": "kingdee-erp-1-0-0.createInbound",
            "description": "创建入库单并提交审核",
            "inputSchema": {
              "type": "object",
              "properties": {
                "sku": { "type": "string", "description": "产品SKU" },
                "quantity": { "type": "number", "description": "入库数量" },
                "warehouseId": { "type": "string", "description": "目标仓库ID" },
                "remark": { "type": "string", "description": "备注（可选）" }
              },
              "required": ["sku", "quantity", "warehouseId"]
            }
          }
        ]
      },
      {
        "packageId": "salesforce-crm-1-0-0",
        "packageName": "Salesforce CRM",
        "tools": [
          {
            "toolName": "salesforce-crm-1-0-0.getCustomer",
            "description": "按客户ID查询客户详细信息",
            "inputSchema": {
              "type": "object",
              "properties": {
                "customerId": { "type": "string", "description": "Salesforce 客户记录ID" }
              },
              "required": ["customerId"]
            }
          }
        ]
      }
    ]
  }
}
```

### 字段说明

| 字段                             | 类型    | 说明                                       |
| -------------------------------- | ------- | ------------------------------------------ |
| `totalTools`                     | number  | Hub 中所有包的工具总数                     |
| `packages[].packageId`           | string  | 包唯一ID（slug 格式）                      |
| `packages[].packageName`         | string  | 包显示名称                                 |
| `packages[].tools[].toolName`    | string  | 完整工具名，格式：`{packageId}.{toolName}` |
| `packages[].tools[].description` | string? | 工具功能描述（AI 用于工具选择）            |
| `packages[].tools[].inputSchema` | object? | JSON Schema 格式的入参定义                 |

### 注意事项

- `toolName` 已带包 ID 前缀（如 `kingdee-erp-1-0-0.getStock`），MCP 调用时直接用此名称
- `inputSchema` 遵循 [JSON Schema Draft 7](https://json-schema.org/)
- 如果某个包尚未推送真实工具定义，该包的 tools 数组可能是桩数据（`tool_1`, `tool_2`），
  skill-claw-cli 应检测并跳过这类包

---

## 接口 2：获取 Hub 连接信息

获取 Hub 的 SSE 地址和所有客户端接入配置。Skill 运行时调工具时需要知道 Hub 地址。

### 请求

```
GET /api/mcp/connect
```

### 响应

```json
{
  "hubName": "sga-mcp-hub",
  "hubSseUrl": "http://hub.example.com/api/mcp",
  "toolCount": 25,
  "clients": {
    "claudeCode": {
      "label": "Claude Code",
      "command": "claude mcp add sga-mcp-hub --transport sse --url http://hub.example.com/api/mcp"
    },
    "cursor": {
      "label": "Cursor",
      "config": { "mcpServers": { "sga-mcp-hub": { "url": "...", "transport": "sse" } } },
      "filePath": ".cursor/mcp.json"
    }
    // ... 其他客户端
  }
}
```

**skill CLI 用途**：`hubSseUrl` 不写入 Skill 文件。运行时所需 Hub 地址通过 `inputSchema` 的 `hub_sse_url` 字段，在用户部署时注入（对应 OpenClaw 四步接入流程第 4 步）。

---

## Skill 定义格式（skill-claw-cli 输出）

skill-claw-cli 基于以上工具编排后，生成 Skill 定义文件。格式建议如下：

```json
{
  "skillId": "erp-inventory-reorder",
  "name": "库存补货工作流",
  "version": "1.0.0",
  "description": "自动检测低库存 SKU 并创建补货入库单",
  "category": "ERP",

  "steps": [
    {
      "stepId": "check-stock",
      "toolName": "kingdee-erp-1-0-0.getStock",
      "description": "查询当前库存",
      "inputs": {
        "sku": "{{input.sku}}",
        "warehouseId": "{{input.warehouseId}}"
      },
      "outputs": {
        "currentStock": "$.quantity"
      }
    },
    {
      "stepId": "create-inbound",
      "condition": "{{steps.check-stock.currentStock}} < {{input.reorderThreshold}}",
      "toolName": "kingdee-erp-1-0-0.createInbound",
      "description": "库存不足时创建入库单",
      "inputs": {
        "sku": "{{input.sku}}",
        "quantity": "{{input.reorderQuantity}}",
        "warehouseId": "{{input.warehouseId}}",
        "remark": "自动补货触发"
      }
    }
  ],

  "inputSchema": {
    "type": "object",
    "properties": {
      "hub_sse_url": {
        "type": "string",
        "description": "SGA MCP Hub SSE 接入地址（部署时由用户提供）"
      },
      "sku": { "type": "string", "description": "要检查的产品SKU" },
      "warehouseId": { "type": "string", "description": "仓库ID" },
      "reorderThreshold": { "type": "number", "description": "触发补货的库存阈值" },
      "reorderQuantity": { "type": "number", "description": "补货数量" }
    },
    "required": ["hub_sse_url", "sku", "warehouseId", "reorderThreshold", "reorderQuantity"]
  }
}
```

---

## 接口 3：发布 Skill 到 Market

Skill 生成后发布到 SGA Market（与普通 MCP 包使用相同 API，通过 category 区分）。

### 请求

```
POST {MARKET_URL}/api/packages/sync/push
Authorization: Bearer <market-token>
Content-Type: multipart/form-data
```

**字段**：

| 字段       | 类型        | 说明                                        |
| ---------- | ----------- | ------------------------------------------- |
| `file`     | Blob        | Skill 包 tgz（包含 skill.json + README.md） |
| `metadata` | JSON string | 见下方                                      |

**metadata 结构**：

```json
{
  "packageId": "erp-inventory-reorder-1-0-0",
  "manifest": {
    "id": "erp-inventory-reorder-1-0-0",
    "name": "erp-inventory-reorder",
    "version": "1.0.0",
    "description": "自动检测低库存 SKU 并创建补货入库单",
    "category": "skill",
    "toolCount": 0,
    "serverCount": 0,

    "skillMeta": {
      "hubRequired": true,
      "stepCount": 2,
      "requiredTools": ["kingdee-erp-1-0-0.getStock", "kingdee-erp-1-0-0.createInbound"],
      "requiredPackages": ["kingdee-erp-1-0-0"]
    }
  },
  "autoDeploy": false
}
```

### 关键字段 `skillMeta`

| 字段               | 说明                                |
| ------------------ | ----------------------------------- |
| `hubRequired`      | true = 需要 Hub 才能运行            |
| `stepCount`        | Skill 包含的步骤数                  |
| `requiredTools`    | 依赖的工具完整名称列表              |
| `requiredPackages` | 依赖的 Hub 包列表（用于兼容性检查） |

---

## 完整工作流示意

```
skill-claw-cli
  │
  ├─ Step 1: mcp-claw hub connect <hub-url>
  │           → 保存 hub.url 到 config.yaml
  │           → 验证 Hub 连通性
  │
  ├─ Step 2: GET /api/repo/tools/catalog
  │           → 获取所有可用工具及其 inputSchema
  │           → 过滤掉桩工具（toolName 含 .tool_）
  │
  ├─ Step 3: skill generate <description>
  │           → 基于工具目录，用 LLM 编排工作流
  │           → 生成 skill.json（含 steps + inputSchema，hub_sse_url 在 inputSchema 中）
  │           → 生成 README.md
  │
  ├─ Step 4: skill publish --workflow
  │           → 打包 tgz
  │           → POST /api/packages/sync/push → Market
  │           → Market AI Agent 自动审核（重点检查 requiredTools 是否真实存在）
  │
  └─ Step 5: 用户在 Hub 安装 Skill
              → Skill 运行时按步骤调用 Hub 工具
              → Hub MCP Gateway 代理实际 API 调用
```

---

## 环境变量 / 配置

skill-claw-cli 需要配置：

```yaml
# ~/.skillcli/config.yaml（通过 mcp-claw config set 写入）
hub:
  url: http://hub.example.com/api/mcp # mcp-claw hub connect 写入

market:
  url: https://market.example.com
  token: <your-token> # mcp-claw login 写入

openrouter:
  apiKey: <your-openrouter-key>
  model: anthropic/claude-sonnet-4-6
```

---

## 错误处理

| HTTP 状态码 | 含义           | 处理建议         |
| ----------- | -------------- | ---------------- |
| 200         | 成功           | 解析 `data` 字段 |
| 401         | 未认证         | 检查 token       |
| 404         | 包/工具不存在  | 跳过该包         |
| 503         | Hub 暂时不可用 | 重试（指数退避） |

`code != 0` 时表示业务错误，`message` 字段有描述。

---

## 当前限制（v1.0）

1. **工具 catalog 无认证**：当前 `/api/repo/tools/catalog` 不需要 token，后续版本会加 Hub API Key
2. **桩工具过滤**：toolName 含 `.tool_N`（如 `.tool_1`）的是旧版包的桩数据，请忽略
3. **无工具测试端点**：暂不支持在 skill 开发阶段直接通过 API 测试工具调用，需本地运行 Hub
4. **skills/activate 未实现**：MCP 协议扩展（context 优化方案）计划 v2 实现

---

## 联系 & 反馈

Hub 接口由 SGA MCP Hub 团队维护。如接口有问题或需要新增能力，请联系对接人。
