# Phase 2.5: CLI Agent (Terminal UI) — 详细计划

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 实现 `@mcp-claw/cli` 终端交互界面，提供类似 Claude Code 的沉浸式 AI Agent 体验。

---

### Task 2.5.1: CLI 入口与命令解析

**Files:**
- Create: `packages/cli/bin/mcp-claw.ts`
- Create: `packages/cli/src/index.ts`

**代码实现:**
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { startRepl } from '../src/ui/terminal';
import { generate } from '../src/commands/generate';
import { deploy } from '../src/commands/deploy';
import pkg from '../package.json';

const program = new Command();

program
  .name('mcp-claw')
  .description('AI Agent CLI for MCP Server Generation')
  .version(pkg.version);

program
  .command('repl')
  .description('Start interactive AI session (Default)')
  .action(async () => {
    await startRepl();
  });

program
  .command('gen <input>')
  .description('Generate MCP server from document')
  .option('-o, --output <dir>', 'Output directory', './output')
  .action(async (input, options) => {
    await generate(input, options);
  });

program
  .command('deploy')
  .description('Deploy generated servers')
  .action(async () => {
    await deploy();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  startRepl();
}
```

---

### Task 2.5.2: 交互式 REPL 终端核心

**Files:**
- Create: `packages/cli/src/ui/terminal.ts`

**代码实现:**
```typescript
import * as readline from 'readline';
import chalk from 'chalk';
import { AgentLoop } from '../loop/agent-loop';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.blue('mcp-claw> ')
});

export async function startRepl() {
  console.log(chalk.bold.cyan('Welcome to MCP Claw CLI'));
  console.log(chalk.gray('Type "help" for commands or describe your task.
'));

  const agent = new AgentLoop();

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'exit') {
      rl.close();
      process.exit(0);
    }

    if (input) {
      // 暂停 Prompt，等待 Agent 执行
      await agent.handleInput(input);
    }

    rl.prompt();
  }).on('close', () => {
    console.log('Bye!');
    process.exit(0);
  });
}
```

---

### Task 2.5.3: 输出渲染系统 (Themes & Agents)

**Files:**
- Create: `packages/cli/src/ui/theme.ts`
- Create: `packages/cli/src/ui/renderer.ts`

**代码实现:**
```typescript
import chalk from 'chalk';

export const Theme = {
  Explorer: chalk.hex('#3b82f6'), // Blue
  Architect: chalk.hex('#8b5cf6'), // Purple
  Builder: chalk.hex('#eab308'),   // Yellow
  Tester: chalk.hex('#22c55e'),    // Green
  Deployer: chalk.hex('#ef4444'),  // Red
  System: chalk.gray,
};

export class Renderer {
  static agentLog(role: keyof typeof Theme, message: string) {
    const color = Theme[role];
    const iconMap = {
      Explorer: '🔍',
      Architect: '🧠',
      Builder: '⚡',
      Tester: '🧪',
      Deployer: '🚀'
    };
    console.log(`${color(iconMap[role])} ${color.bold(role)}: ${message}`);
  }

  static markdown(text: string) {
    // 简单 Markdown 渲染模拟
    console.log(text.replace(/`([^`]+)`/g, chalk.yellow('$1'))
                    .replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1')));
  }
}
```

---

### Task 2.5.4: 进度动画与 Spinner

**Files:**
- Create: `packages/cli/src/ui/spinner.ts`

**代码实现:**
```typescript
import ora from 'ora';

export class ProgressManager {
  private spinner = ora();

  start(text: string) {
    this.spinner.start(text);
  }

  succeed(text: string) {
    this.spinner.succeed(text);
  }

  fail(text: string) {
    this.spinner.fail(text);
  }

  update(text: string) {
    this.spinner.text = text;
  }
  
  async wrapTask<T>(text: string, task: () => Promise<T>): Promise<T> {
    this.start(text);
    try {
      const result = await task();
      this.succeed(`${text} - Done`);
      return result;
    } catch (err) {
      this.fail(`${text} - Failed`);
      throw err;
    }
  }
}
```

---

### Task 2.5.5: 表格与结构化输出

**Files:**
- Create: `packages/cli/src/ui/table.ts`

**代码实现:**
```typescript
import Table from 'cli-table3';
import chalk from 'chalk';

export function renderApiTable(apis: any[]) {
  const table = new Table({
    head: [chalk.cyan('Method'), chalk.cyan('Path'), chalk.cyan('Summary')],
    colWidths: [10, 40, 50]
  });

  apis.forEach(api => {
    const methodColor = api.method === 'GET' ? chalk.green : chalk.yellow;
    table.push([methodColor(api.method), api.path, api.summary]);
  });

  console.log(table.toString());
}

export function renderTokenBudget(analysis: any) {
  const table = new Table({
    head: ['Shard', 'Tool Count', 'Token Usage', 'Status']
  });

  analysis.shards.forEach((s: any) => {
    const status = s.tokens > 8000 ? chalk.red('OVERFLOW') : chalk.green('OK');
    table.push([s.name, s.tools.length, s.tokens, status]);
  });

  console.log(table.toString());
}
```

---

### Task 2.5.6: 确认交互流程 (Inquirer)

**Files:**
- Create: `packages/cli/src/ui/prompt.ts`

**代码实现:**
```typescript
import inquirer from 'inquirer';

export async function confirmPlan(planSummary: string): Promise<boolean> {
  console.log('
Proposed Plan:');
  console.log(planSummary);
  
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Do you want to proceed with this plan?',
      default: true
    }
  ]);
  
  return confirmed;
}

export async function selectItems(items: string[]): Promise<string[]> {
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select items to process:',
      choices: items
    }
  ]);
  return selected;
}
```

---

### Task 2.5.7: 错误处理与帮助系统

**Files:**
- Create: `packages/cli/src/utils/error-handler.ts`

**代码实现:**
```typescript
import chalk from 'chalk';

export function handleError(err: any) {
  console.error(chalk.red('
❌ Error Occurred:'));
  
  if (err.code === 'ENOENT') {
    console.error(`File not found: ${err.path}`);
    console.log(chalk.yellow('Tip: Check if the file path is correct relative to current directory.'));
  } else if (err.isAxiosError) {
    console.error(`API Error: ${err.response?.status} - ${err.response?.statusText}`);
  } else {
    console.error(err.message || err);
  }
  
  // Optional: Log to file
}
```

---

### Task 2.5.8: 配置文件管理

**Files:**
- Create: `packages/cli/src/config/config-manager.ts`

**代码实现:**
```typescript
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.mcp-claw', 'config.json');

export interface CliConfig {
  model: string;
  apiKey?: string;
  outputDir: string;
}

export const ConfigManager = {
  async load(): Promise<CliConfig> {
    if (await fs.pathExists(CONFIG_PATH)) {
      return fs.readJson(CONFIG_PATH);
    }
    return { model: 'claude-3-5-sonnet', outputDir: './output' };
  },

  async save(config: CliConfig) {
    await fs.ensureDir(path.dirname(CONFIG_PATH));
    await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
  }
};
```

---

### Task 2.5.9: 日志系统

**Files:**
- Create: `packages/cli/src/utils/logger.ts`

**代码实现:**
```typescript
import fs from 'fs-extra';
import path from 'path';

const LOG_FILE = 'mcp-claw-debug.log';

export const Logger = {
  log(msg: string) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] INFO: ${msg}
`;
    fs.appendFileSync(LOG_FILE, line);
  },

  error(msg: string, err?: any) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ERROR: ${msg} ${err ? JSON.stringify(err) : ''}
`;
    fs.appendFileSync(LOG_FILE, line);
  }
};
```

---

### Task 2.5.10: CLI package.json 与构建配置

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsup.config.ts`

**package.json 实现:**
```json
{
  "name": "@mcp-claw/cli",
  "version": "0.1.0",
  "bin": {
    "mcp-claw": "./dist/mcp-claw.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/mcp-claw.js"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "cli-table3": "^0.6.3",
    "fs-extra": "^11.1.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/inquirer": "^9.0.0",
    "@types/fs-extra": "^11.0.0"
  }
}
```

**tsup.config.ts 实现:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/mcp-claw.ts'],
  format: ['cjs'],
  target: 'node16',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: true,
});
```

---

### Task 2.5.11: 验证构建

**Step 1: 安装依赖**
Run: `pnpm install` in `packages/cli`

**Step 2: 构建**
Run: `pnpm build`

**Step 3: 测试运行**
Run: `node dist/mcp-claw.js --help`
Expected Output: Help information for `mcp-claw`.

---

### Task 2.5.12: Git 提交

```bash
git add packages/cli
git commit -m "feat: 实现 CLI 终端 UI 和交互框架"
```

CCB_DONE: 20260217-012439-279-18268-3
