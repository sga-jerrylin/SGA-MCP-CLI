# Phase 2: AI 生成引擎 + 安全基础 — 详细计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 实现 AI 自动生成 MCP Connector 代码，沙箱安全执行，凭证加密存储

**时间:** 2 周（最核心 Phase）

**策略:** 串行开发（有依赖关系），Codex 主导后端，Gemini 并行开发前端

---

## 后端任务（Codex 负责）

### Task 2.1: IR（中间表示）设计

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/generator/types/ir.ts`
- Create: `packages/backend/src/generator/types/ir.schema.ts` (Zod 验证)

**核心数据结构:**

```typescript
// IR 中间表示
export interface IR {
  system: {
    code: string;           // 系统代号，如 'sga_phone'
    name: string;           // 系统名称
    baseUrl: string;        // API 基础 URL
    auth: AuthConfig;       // 鉴权配置
  };
  tools: ToolDefinition[];  // 工具定义列表
}

export interface AuthConfig {
  type: 'bearer' | 'api-key' | 'oauth2' | 'hmac' | 'none';
  headerName?: string;      // 如 'Authorization'
  headerFormat?: string;    // 如 'Bearer {token}'
  oauth?: {
    clientIdField: string;
    clientSecretField: string;
    tokenUrl: string;
  };
}

export interface ToolDefinition {
  name: string;             // 完整名称，如 'sga_phone.send_text'
  displayName: string;      // 中文名
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  needsConfirmation: boolean; // 是否需要用户确认
  isAsync: boolean;          // 是否异步
  estimatedDuration?: string; // 如 '10s-5min'
  params: ParamDefinition[];
  response: ResponseDefinition;
  errors: ErrorDefinition[];
  examples: ExampleData[];
}
```

**验证:** Zod schema 验证 IR 格式正确性

---

### Task 2.2: Markdown 文档解析器

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/generator/parsers/markdown-parser.ts`
- Create: `packages/backend/src/generator/parsers/markdown-parser.spec.ts`

**TDD 流程:**

1. **写测试:** 加载测试 Markdown 文档 → 期望输出正确的 IR
2. **实现解析器:** 正则匹配标题、表格、代码块
3. **运行测试:** 通过

**关键代码:**

```typescript
export class MarkdownParser {
  parse(markdown: string): IR {
    const sections = this.splitSections(markdown);

    const systemInfo = this.parseSystemInfo(sections.system);
    const tools = sections.tools.map(t => this.parseToolSection(t));

    return { system: systemInfo, tools };
  }

  private parseSystemInfo(text: string): IR['system'] {
    // 解析 "## 系统信息" 部分
    const code = this.extractField(text, '系统代号');
    const baseUrl = this.extractField(text, '基础URL');
    const auth = this.parseAuth(text);
    return { code, name: code, baseUrl, auth };
  }

  private parseToolSection(text: string): ToolDefinition {
    // 解析 "### sga_phone.send_text" 部分
    const name = this.extractToolName(text);
    const displayName = this.extractField(text, '中文名');
    const params = this.parseParamsTable(text);
    const response = this.parseResponseTable(text);
    // ...
    return { name, displayName, /* ... */ };
  }
}
```

**测试数据:** 使用设计文档中的 Markdown 模板

---

### Task 2.3: OpenAPI 适配器

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/generator/adapters/openapi-adapter.ts`
- Create: `packages/backend/src/generator/adapters/openapi-adapter.spec.ts`

**依赖:** `openapi-mcp-generator` (npm 安装)

**策略:** 适配器模式，不 fork

```typescript
import { parseOpenAPI } from 'openapi-mcp-generator';

export class OpenAPIAdapter {
  async toIR(openApiSpec: object): Promise<IR> {
    // 调用 openapi-mcp-generator 解析
    const parsed = await parseOpenAPI(openApiSpec);

    // 转换为我们的 IR 格式
    return this.convert(parsed);
  }

  private convert(parsed: any): IR {
    // 映射字段
    return {
      system: {
        code: parsed.info.title.toLowerCase().replace(/\s+/g, '_'),
        baseUrl: parsed.servers[0].url,
        auth: this.convertAuth(parsed.components?.securitySchemes),
      },
      tools: parsed.paths.map(p => this.convertPath(p)),
    };
  }
}
```

---

### Task 2.4: 代码生成器（核心）

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/generator/code-gen/tool-generator.ts`
- Create: `packages/backend/src/generator/code-gen/connector-generator.ts`
- Create: `packages/backend/src/generator/prompts/code-gen.prompt.ts`

**步骤:**

1. **Tool 定义生成:**
   - IR → JSON Schema → Zod schema
   - 生成 `tools/<tool-name>.ts` 文件

2. **Connector 代码生成 (AI):**
   - 使用 Claude Sonnet 4.5
   - Prompt: 包含 IR + Connector 模板 + 需求
   - 输出: `auth.ts`, `client.ts`, `tools/*.ts`

**Prompt 模板:**

````typescript
export const CODE_GEN_PROMPT = `
你是一个 MCP Connector 代码生成专家。根据以下 API 接口定义，生成 TypeScript 代码。

## 系统信息
- 系统代号: {{system.code}}
- 基础 URL: {{system.baseUrl}}
- 鉴权方式: {{system.auth.type}}

## 工具列表
{{#each tools}}
### {{name}}
- 中文名: {{displayName}}
- 方法: {{method}} {{path}}
- 参数: {{params}}
- 响应: {{response}}
{{/each}}

## 要求
1. 生成 auth.ts（鉴权模块）
2. 生成 client.ts（HTTP 客户端）
3. 生成 tools/*.ts（每个工具的实现）
4. 使用 axios 发送请求
5. 所有参数用 Zod 验证
6. 错误处理归一化到 6 类（见文档）
7. 需要确认的工具添加 needsConfirmation 标记

## 输出格式
\`\`\`typescript
// auth.ts
export class AuthHandler {
  // ...
}

// client.ts
export class APIClient {
  // ...
}

// tools/send_text.ts
export async function send_text(params: SendTextParams): Promise<SendTextResponse> {
  // ...
}
\`\`\`
`;
````

**AI 调用:**

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class ConnectorGenerator {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  async generate(ir: IR): Promise<GeneratedCode> {
    const prompt = this.renderPrompt(ir);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const code = this.extractCode(response.content[0].text);
    return code;
  }
}
```

---

### Task 2.5: Sandbox Worker（隔离执行）

**负责人:** Codex

**Files:**
- Create: `packages/sandbox-worker/src/worker.ts`
- Create: `packages/sandbox-worker/src/executor.ts`
- Create: `packages/sandbox-worker/Dockerfile`
- Create: `scripts/iptables-setup.sh`

**Dockerfile:**

```dockerfile
# packages/sandbox-worker/Dockerfile
FROM node:20-alpine

# 安全：非 root 用户
RUN addgroup -g 1001 sandbox && adduser -D -u 1001 -G sandbox sandbox

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod

# 复制代码
COPY --chown=sandbox:sandbox . .

# 切换到非特权用户
USER sandbox

# 资源限制（在 docker-compose 中设置）
# --cpus=2 --memory=4g --pids-limit=100

CMD ["node", "dist/worker.js"]
```

**Worker 逻辑:**

```typescript
// packages/sandbox-worker/src/worker.ts
import { Worker } from 'bullmq';
import { Executor } from './executor';

const worker = new Worker('generator', async (job) => {
  const { ir, projectId } = job.data;

  const executor = new Executor(projectId);

  try {
    // 1. 生成代码
    await executor.generateCode(ir);

    // 2. 编译 TypeScript
    await executor.compile();

    // 3. 运行 Mock 测试
    const testResult = await executor.runTests();

    // 4. 如果失败，AI 修复（最多 3 轮）
    if (!testResult.passed) {
      await executor.autoFix(testResult.errors);
    }

    // 5. 打包
    const packagePath = await executor.package();

    // 6. 上传到 MinIO
    await executor.uploadArtifact(packagePath);

    return { status: 'success', packagePath };
  } catch (err) {
    return { status: 'failed', error: err.message };
  } finally {
    // 清理临时文件
    await executor.cleanup();
  }
}, {
  connection: {
    host: 'redis',
    port: 6379,
  },
});
```

**iptables 网络策略:**

```bash
# scripts/iptables-setup.sh
#!/bin/bash

# 默认拒绝所有出站
iptables -A DOCKER-USER -i br-sandbox -j DROP

# 白名单: AI Provider
iptables -I DOCKER-USER -i br-sandbox -d api.anthropic.com -p tcp --dport 443 -j ACCEPT
iptables -I DOCKER-USER -i br-sandbox -d api.openai.com -p tcp --dport 443 -j ACCEPT

# 白名单: Hub API
HUB_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' mcp-hub-api)
iptables -I DOCKER-USER -i br-sandbox -d $HUB_IP -p tcp --dport 3000 -j ACCEPT

# 白名单: MinIO
MINIO_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' mcp-hub-minio)
iptables -I DOCKER-USER -i br-sandbox -d $MINIO_IP -p tcp --dport 9000 -j ACCEPT
```

---

### Task 2.6: 测试生成器 + 运行器

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/generator/test-gen/test-generator.ts`

**Mock 测试生成:**

```typescript
export class TestGenerator {
  generate(tool: ToolDefinition): string {
    return `
import { describe, it, expect } from 'vitest';
import { ${tool.name.split('.')[1]} } from '../tools/${tool.name}';

describe('${tool.displayName}', () => {
  it('should validate input schema', async () => {
    const validInput = ${JSON.stringify(tool.examples[0].request)};
    const result = await ${tool.name.split('.')[1]}(validInput);
    expect(result).toBeDefined();
  });

  it('should reject invalid input', async () => {
    await expect(${tool.name.split('.')[1]}({})).rejects.toThrow();
  });
});
    `;
  }
}
```

---

### Task 2.7: AI 自动修复循环

**负责人:** Codex

**逻辑:**

```typescript
async function autoFix(errors: TestError[], maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    // 1. 用 Claude Opus 分析错误
    const analysis = await analyzeErrors(errors);

    // 2. 生成修复代码
    const fixedCode = await generateFix(analysis);

    // 3. 应用修复
    await applyPatch(fixedCode);

    // 4. 重新测试
    const result = await runTests();

    if (result.passed) {
      return true;
    }

    errors = result.errors;
  }

  // 3 轮仍失败，标记需人工介入
  await markAsNeedsManualIntervention();
  return false;
}
```

---

### Task 2.8: Auth Vault 完整实现（主密钥轮换）

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/auth-vault/key-rotation.service.ts`

**密钥轮换逻辑:**

```typescript
export class KeyRotationService {
  async rotate(newKeyVersion: number): Promise<void> {
    // 1. 加载新主密钥
    this.loadMasterKey(newKeyVersion);

    // 2. 查询所有旧版本凭证
    const oldCreds = await this.credentialRepo.find({
      where: { keyVersion: LessThan(newKeyVersion) },
    });

    // 3. 批量重新加密
    for (const cred of oldCreds) {
      const plaintext = await this.vault.decrypt(
        cred,
        cred.tenantId,
        cred.serverId,
        cred.keyName
      );

      const reencrypted = await this.vault.encrypt({
        ...cred,
        plaintext,
      });

      await this.credentialRepo.update(cred.id, {
        ...reencrypted,
        keyVersion: newKeyVersion,
      });
    }

    // 4. 删除旧密钥（可选，保留一段时间以防回滚）
  }
}
```

---

## 前端任务（Gemini 负责）

### Task 2.9: MCP 生成器页面

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/views/Generator/Index.vue`
- Create: `packages/frontend/src/views/Generator/ProjectList.vue`
- Create: `packages/frontend/src/views/Generator/ProjectDetail.vue`
- Create: `packages/frontend/src/views/Generator/ImportModal.vue`

**核心交互:**

1. **项目列表（左侧）:**
   - 卡片展示（项目名 + 进度 + 状态图标）
   - 点击切换到详情

2. **项目详情（右侧）:**
   - Tab 1: Tool 列表（状态：✅成功 / 🔄生成中 / ❌失败）
   - Tab 2: 生成日志（LogTerminal 组件，SSE 实时流）
   - Tab 3: 配置（系统代号/分类/鉴权）

3. **导入模态框:**
   - 拖拽上传（Markdown / OpenAPI YAML / Postman JSON）
   - 自动识别格式
   - 上传后显示解析预览

**SSE 实时日志:**

```typescript
// 连接 SSE
const eventSource = new EventSource(`/api/generator/projects/${id}/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  logs.value.push({
    timestamp: new Date().toLocaleTimeString(),
    message: data.message,
  });
};
```

---

### Task 2.10: AI 引擎设置页面

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/views/Settings/AIEngine.vue`
- Create: `packages/frontend/src/components/ProviderManager.vue`

**UI 设计:**

1. **Provider 管理:**
   - 列表（Anthropic / OpenAI / Google / DeepSeek / 本地 Ollama）
   - 添加按钮 → 输入 API Key → 测试连通性

2. **模型分配:**
   - 文档解析（文本）: 下拉选择模型
   - 文档解析（视觉）: 下拉选择（仅显示视觉模型）
   - 代码生成: 下拉选择
   - 错误修复: 下拉选择

3. **提示词模板编辑:**
   - Monaco Editor（YAML 高亮）
   - 恢复默认按钮

---

### Task 2.11: 凭证配置表单

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/components/CredentialForm.vue`

**动态表单生成:**

```vue
<template>
  <a-form :model="formData">
    <a-form-item
      v-for="field in fields"
      :key="field.name"
      :label="field.label"
      :name="field.name"
    >
      <!-- 如果是密码/Key 类型 -->
      <a-input-password
        v-if="field.type === 'secret'"
        v-model:value="formData[field.name]"
        :placeholder="field.existing ? '••••••••' : field.placeholder"
      />

      <!-- 普通文本 -->
      <a-input v-else v-model:value="formData[field.name]" />
    </a-form-item>

    <a-button type="primary" @click="testConnection">
      测试连通性
    </a-button>
  </a-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'secret' | 'number';
    placeholder: string;
    existing?: boolean; // 已存在的凭证不回显
  }>;
}>();

const formData = ref({});
</script>
```

---

## Phase 2 验收标准

**后端（Codex）:**
- [x] Markdown → IR 解析器测试通过
- [x] OpenAPI → IR 适配器测试通过
- [x] 代码生成器可生成 Connector 代码
- [x] Sandbox Worker 可运行（Docker 容器）
- [x] iptables 网络策略生效
- [x] Auth Vault 主密钥轮换功能
- [x] 端到端测试：上传 Markdown → 生成代码 → 测试通过

**前端（Gemini）:**
- [x] MCP 生成器页面（项目列表 + 详情）
- [x] 文档导入拖拽上传工作
- [x] SSE 实时日志流显示
- [x] AI 引擎设置页面（Provider + 模型分配）
- [x] 凭证配置表单（动态生成 + 脱敏）

**集成测试:**

```bash
# 上传测试 Markdown
curl -X POST http://localhost:3000/api/generator/projects \
  -F "file=@test-api.md" \
  -F "name=Test Project"

# 触发生成
curl -X POST http://localhost:3000/api/generator/projects/{id}/generate

# 检查生成结果
curl http://localhost:3000/api/generator/projects/{id}

# 下载生成的代码包
curl http://localhost:3000/api/generator/projects/{id}/download
```

---

## 下一步

Phase 2 完成后，进入 **Phase 3: 配置仓库 + 打包 + 云端管理后台**

**关键任务:**
- 配置包打包（tar.gz + manifest.json）
- RSA 签名验证
- 云端仓库 API（上传/下载/搜索）
- 云端管理后台（租户/Key 管理）

**预计时间:** 1 周
