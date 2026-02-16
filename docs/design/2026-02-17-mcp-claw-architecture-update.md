# MCP Claw 架构调整备忘录

> 日期: 2026-02-17
> 状态: 已批准，进入计划更新阶段

## 核心决策

MCP Hub项目升级为 **MCP Claw 生态**，包含两个产品：

1. **@mcp-claw/cli** — 开源AI Agent CLI，专注MCP Server生成
2. **MCP Hub** — 企业级Web管理平台，基于共享引擎

## 产品定位

```
MCP Claw CLI（开源）= MCP开发者的垂直AI Agent
MCP Hub（商业）= 企业MCP管理平台
@mcp-claw/core（共享引擎）= 两者共用的核心
```

## Monorepo结构调整

### 变更前
```
packages/
  backend/           ← 引擎内嵌在后端
  frontend/
  mcp-server/
```

### 变更后
```
packages/
  core/              ← @mcp-claw/core 共享引擎（新增）
    src/
      ir/            # 中间表示（从backend迁移）
      parsers/       # 多格式解析器（Markdown/OpenAPI/Web）
      codegen/       # AI代码生成
      sandbox/       # 沙箱测试
      autofix/       # 自动修复循环
      budget/        # Token预算检查+自动分片
      packager/      # 配置包签名+SBOM
    package.json     # @mcp-claw/core

  cli/               ← @mcp-claw/cli 开源CLI Agent（新增）
    src/
      agents/        # Agent Team
        explorer.ts  # 探索者：文件系统+Docker+网页+API探测
        architect.ts # 架构师：分析+分片规划+接口契约
        builder.ts   # 构建者：调用core生成代码
        tester.ts    # 测试者：沙箱测试+触发修复
        deployer.ts  # 部署者：docker-compose生成+启动
      tools/         # Agent可用工具集
        fs.ts        # 文件系统读写
        docker.ts    # Docker容器交互（inspect/logs/exec）
        web.ts       # 网页抓取+解析
        http.ts      # HTTP端点探测
        shell.ts     # Shell命令执行
        git.ts       # Git操作
      ui/            # 终端UI
        terminal.ts  # 交互式REPL（类似Claude Code）
        spinner.ts   # 进度展示
        theme.ts     # 主题配色
      loop/          # Agent核心循环
        agent-loop.ts    # Plan→Act→Observe主循环
        memory.ts        # 上下文记忆
        conversation.ts  # 对话管理
      config/
        models.ts    # AI模型配置（多模型支持）
    bin/
      mcp-claw.ts    # CLI入口
    package.json     # @mcp-claw/cli

  backend/           ← MCP Hub后端（引用core，变薄）
    src/
      generator/     # 薄层：REST API包装core
      vault/         # Auth Vault（Hub专有）
      deploy/        # 部署编排（Hub专有）
      admin/         # 多租户管理（Hub专有）
    package.json

  frontend/          ← MCP Hub前端（不变）
  mcp-server/        ← MCP Server运行时（不变）
```

## Phase规划调整

### 变更前（6 Phase）
```
Phase 0: 项目初始化
Phase 1: 骨架搭建
Phase 2: AI引擎（内嵌backend）
Phase 3: 配置仓库+打包
Phase 4: MCP运行时+部署
Phase 5: 监控+治理
Phase 6: 集成+打磨
```

### 变更后（7 Phase）
```
Phase 0: 项目初始化（调整monorepo结构）
Phase 1: 骨架搭建（加core和cli包骨架）
Phase 2: 核心引擎（写在packages/core/下）★路径变更
Phase 2.5: CLI Agent（packages/cli/）★新增Phase
Phase 3: 配置仓库+打包（core的packager模块）
Phase 4: MCP运行时+部署+Hub后端
Phase 5: 监控+治理（Hub专有）
Phase 6: 集成测试+CLI开源发布+Hub打磨
```

## Phase 2 变更说明（Codex参考）

### 文件路径迁移规则
```
旧路径: packages/backend/src/generator/ir/
新路径: packages/core/src/ir/

旧路径: packages/backend/src/generator/parsers/
新路径: packages/core/src/parsers/

旧路径: packages/backend/src/generator/codegen/
新路径: packages/core/src/codegen/

旧路径: packages/backend/src/generator/adapters/
新路径: packages/core/src/adapters/

旧路径: packages/backend/src/generator/autofix/
新路径: packages/core/src/autofix/
```

### Hub后端变为薄层
```typescript
// packages/backend/src/generator/generator.service.ts
// 旧: 直接包含生成逻辑
// 新: 调用core包

import { MpcClawCore } from '@mcp-claw/core';

@Injectable()
export class GeneratorService {
  private core = new MpcClawCore(this.config);

  async generateFromDoc(doc: Buffer, options: GenerateOptions) {
    return this.core.generate(doc, options); // 委托给core
  }
}
```

## Phase 2.5 概要（CLI Agent，新增）

### Codex负责（后端逻辑）
- Agent Loop（Plan→Act→Observe循环）
- Explorer工具集（文件系统扫描、Docker检查、API探测）
- Architect逻辑（Token预算分析、分片决策）
- Builder/Tester/Deployer集成（调用core）
- 模型配置管理（多模型支持）

### Gemini负责（终端UI + 交互）
- 交互式REPL终端（类Claude Code体验）
- 彩色输出、进度动画、表格展示
- 对话流程设计（用户输入→Agent响应→确认→执行）
- 帮助系统和错误提示
- CLI入口和命令行参数解析

## CLI Agent Team设计

### 5个Agent角色

| Agent | 职责 | 核心工具 |
|-------|------|---------|
| Explorer | 发现和理解API | fs、docker、web、http |
| Architect | 分析和规划 | core.budget、core.ir |
| Builder | 生成代码 | core.codegen、core.adapters |
| Tester | 测试和修复 | core.sandbox、core.autofix |
| Deployer | 部署和验证 | docker、shell |

### Agent Loop流程
```
用户输入
  → Explorer 探索目标（文件/Docker/网页）
    → Architect 分析并规划（分片、Tool分配）
      → 用户确认计划
        → Builder 生成代码
          → Tester 沙箱测试
            → 失败? → Builder 自动修复（最多3轮）
              → Deployer 部署（可选）
                → 输出结果
```

## 工作量评估

| 项目 | Tasks变化 |
|------|----------|
| Phase 2 core引擎 | -5 Tasks（路径调整，部分Task合并） |
| Phase 2.5 CLI Agent（Codex） | +20 Tasks |
| Phase 2.5 CLI UI（Gemini） | +10 Tasks |
| Phase 4 Hub后端 | -10 Tasks（变薄） |
| **净增** | 约 +15 Tasks |
| **新增产出** | 一个独立的开源CLI产品 |
