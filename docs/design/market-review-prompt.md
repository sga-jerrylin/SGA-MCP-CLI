# Market 审核 Agent Prompt 设计

> 版本: v2.0 | 日期: 2026-02-22
> 对应代码: `E:\sga-mcp-market\packages\backend\src\agent\agent-runner.service.ts`

---

## 当前问题

现有 `callLlmReview` 只把 `name / version / description / toolsCount` 传给 LLM，
相当于只看"包装盒"审核。

现在 manifest 已经有完整的 `tools[]`（含 `inputSchema`），
可以做真正的"验货"审核。

---

## 需要先做的基础设施

`PackageEntity` 加一列（`simple-json`，nullable）：

```typescript
@Column('simple-json', { nullable: true, default: null })
tools!: Array<{
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}> | null;
```

包同步接口收到 `manifest.tools` 后存入该列。审核时取出传给 LLM。

---

## 升级后的审核 Prompt

```
callLlmReview(config, pkg) 里替换 prompt 变量内容
```

### Prompt 模板

```
You are a security and quality reviewer for an MCP (Model Context Protocol) tool registry.

MCP tools are called autonomously by AI agents (like Claude, GPT) to interact with real business systems
(ERP, CRM, databases). A bad tool can cause data corruption, credential leaks, or AI hallucinations.

Your job: decide if this package is safe and useful enough to be publicly listed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACKAGE INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:        ${pkg.name}
Version:     ${pkg.version}
Category:    ${pkg.category}
Description: ${pkg.description || '(empty)'}
Tools count: ${pkg.toolsCount}
Credentials required: ${credentialsSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOL DEFINITIONS (from manifest.json)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toolsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score from 0-100. Start at 75 as baseline for any package with real tool definitions.

SECURITY (up to -40 points for violations):
  - Tools with vague names like "execute", "run", "eval" → -20
  - Description mentions file system access, shell exec, code eval → -20
  - Credentials count > 5 (suspicious over-permission) → -10
  - Tool names contain "admin", "sudo", "root" without clear justification → -10

MANIFEST ACCURACY (up to -20 points):
  - Declared toolsCount != actual tools[] length → -10
  - Tools have no description at all → -5
  - inputSchema missing for ALL tools (especially if params are obvious) → -5

TOOL QUALITY (up to -15 points):
  - Tool descriptions are too vague to be useful to AI models (< 10 chars) → -10
  - Parameter names are cryptic (single letter, "p1", "x") → -5
  - All tools do exactly the same thing (likely duplicate/error) → -5

BONUS (up to +10 points):
  - All tools have inputSchema with clear required[] → +5
  - Tool descriptions explain business context, not just technical operation → +5

THRESHOLDS:
  - score >= 70 → approved: true
  - score 50-69 → approved: false, needs_human_review
  - score < 50  → approved: false, high_risk

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT (JSON only, no explanation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "approved": boolean,
  "score": number,
  "riskLevel": "low" | "medium" | "high",
  "note": "简短中文审核说明，说明加减分原因（100字以内）",
  "summary": "用中文改写的包功能简介，更适合在市场展示（150字以内）",
  "toolQualityHints": ["工具名1的建议", "工具名2的建议"]
}
```

---

## Prompt 拼装逻辑（TypeScript 示例）

```typescript
// agent-runner.service.ts → callLlmReview() 里替换 prompt 构建部分

// 1. 凭证摘要
const credentialsSummary =
  pkg.credentials && pkg.credentials.length > 0
    ? `${pkg.credentials.length} 个（${pkg.credentials.map((c) => c.key).join(', ')}）`
    : '无';

// 2. 工具清单块
const buildToolsBlock = (
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> | null
): string => {
  if (!tools || tools.length === 0) {
    return '(无工具定义 — 可能是旧格式包)';
  }
  return tools
    .map((tool, i) => {
      const schema = tool.inputSchema
        ? JSON.stringify(tool.inputSchema, null, 2)
        : '(无 inputSchema)';
      return [
        `Tool ${i + 1}: ${tool.name}`,
        `  Description: ${tool.description || '(空)'}`,
        `  InputSchema: ${schema}`
      ].join('\n');
    })
    .join('\n\n');
};

const toolsBlock = buildToolsBlock(pkg.tools);

const prompt = `You are a security and quality reviewer...
[按上方 Prompt 模板，插入 credentialsSummary 和 toolsBlock]
`;
```

---

## 审核结果字段映射

| LLM 返回字段       | 存入 PackageEntity                                 | 说明                     |
| ------------------ | -------------------------------------------------- | ------------------------ |
| `approved`         | `reviewStatus` (`approved` / `needs_human_review`) | 审核结论                 |
| `score`            | `securityScore`                                    | 0-100                    |
| `note`             | `reviewNote`                                       | 审核说明（展示给管理员） |
| `summary`          | `agentSummary`                                     | 建议改写的描述           |
| `riskLevel`        | 不存（仅 webhook 通知用）                          | low/medium/high          |
| `toolQualityHints` | 不存（仅 webhook 通知用）                          | 改进建议                 |

`riskLevel = "high"` 时额外触发企微告警（高危包通知）。

---

## 与旧版对比

| 维度       | 旧版（v1）                | 新版（v2）                            |
| ---------- | ------------------------- | ------------------------------------- |
| 输入数据   | 包名、描述、toolsCount    | + tools[] + inputSchema + credentials |
| 能检测     | 描述是否过短              | 工具名可疑、参数设计、清单一致性      |
| 误报率     | 高（toolsCount=0 就扣分） | 低（有真实工具即可）                  |
| 漏报率     | 高（无法看出工具内容）    | 低（工具名/描述异常可检测）           |
| 审核颗粒度 | 包级别                    | 工具级别                              |

---

## 后续优化方向

1. **代码层审核**：解压 tgz，提取 server.ts 源码传给 LLM，做代码级安全扫描
2. **API 域名校验**：检查 http-client.ts 里的 baseUrl 是否与声明一致
3. **工具 vs 代码交叉验证**：manifest 声明的工具名是否在 server.ts 里有对应 handler
4. **历史版本对比**：同名包新版工具变化超过 50% 时触发人工复审

这些需要解压 tgz 包，是更深层的审核，放 v3 实现。
