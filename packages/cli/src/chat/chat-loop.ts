import * as readline from 'node:readline/promises';
import chalk from 'chalk';

import type { ChatConfig } from './chat-types';
import { ChatSession } from './chat-session';

/** Model presets — displayed in menu order */
const MODEL_PRESETS: Array<{ alias: string; id: string; label: string }> = [
  // Anthropic
  { alias: 'sonnet', id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { alias: 'haiku', id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (便宜快)' },
  { alias: 'opus', id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
  // Qwen
  { alias: 'qwen3.5', id: 'qwen/qwen3.5-plus-02-15', label: 'Qwen 3.5 Plus' },
  { alias: 'qwen3.5-397b', id: 'qwen/qwen3.5-397b-a17b', label: 'Qwen 3.5 397B MoE' },
  // Google
  { alias: 'gemini-flash', id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (便宜快)' },
  { alias: 'gemini-pro', id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
  // Other
  { alias: 'minimax', id: 'minimax/minimax-m2.5', label: 'MiniMax M2.5' },
  { alias: 'glm5', id: 'z-ai/glm-5', label: 'GLM-5 (智谱)' },
  { alias: 'deepseek', id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3' },
  // OpenAI
  { alias: 'gpt4o', id: 'openai/gpt-4o', label: 'GPT-4o' },
  { alias: 'gpt4o-mini', id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (便宜)' },
  { alias: 'o3-mini', id: 'openai/o3-mini', label: 'o3-mini' }
];

/**
 * Interactive model picker — arrow keys to navigate, Enter to select, Esc to cancel.
 * Pauses the readline interface, enters raw mode, then restores when done.
 */
function pickModel(rl: readline.Interface, currentModelId: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Pause readline so we can use raw mode
    rl.pause();
    const stdin = process.stdin;
    const stdout = process.stdout;

    const wasRaw = stdin.isRaw;
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();

    // Find current selection index
    let cursor = Math.max(
      0,
      MODEL_PRESETS.findIndex((m) => m.id === currentModelId)
    );
    const total = MODEL_PRESETS.length;

    const render = () => {
      // Move cursor up to redraw (after first render)
      stdout.write(`\x1b[${total + 2}A`); // move up: items + header + footer
      draw();
    };

    const draw = () => {
      stdout.write(
        `  ${chalk.white.bold('选择模型')} ${chalk.gray('(↑↓ 选择 · Enter 确认 · Esc 取消)')}\n`
      );
      for (let i = 0; i < total; i++) {
        const m = MODEL_PRESETS[i];
        const isSelected = i === cursor;
        const pointer = isSelected ? chalk.cyan('❯') : ' ';
        const alias = isSelected ? chalk.cyan.bold(m.alias) : chalk.white(m.alias);
        const label = isSelected ? chalk.white(m.label) : chalk.gray(m.label);
        const id = chalk.gray.dim(m.id);
        stdout.write(
          `  ${pointer} ${alias.padEnd(isSelected ? 25 : 25)} ${label.padEnd(isSelected ? 35 : 35)} ${id}\n`
        );
      }
      stdout.write(`  ${chalk.gray('─'.repeat(55))}\n`);
    };

    // Initial draw
    draw();

    const onKey = (data: Buffer) => {
      const key = data.toString();

      // Esc or Ctrl+C
      if (key === '\x1b' || key === '\x03') {
        cleanup();
        resolve(null);
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(MODEL_PRESETS[cursor].id);
        return;
      }

      // Arrow up / k
      if (key === '\x1b[A' || key === 'k') {
        cursor = (cursor - 1 + total) % total;
        render();
        return;
      }

      // Arrow down / j
      if (key === '\x1b[B' || key === 'j') {
        cursor = (cursor + 1) % total;
        render();
        return;
      }

      // Number keys 1-9 for quick jump
      const num = parseInt(key, 10);
      if (num >= 1 && num <= total) {
        cursor = num - 1;
        render();
        return;
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onKey);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(wasRaw ?? false);
      }
      rl.resume();
    };

    stdin.on('data', onKey);
  });
}

function printBanner(config: ChatConfig): void {
  const logo = [
    '  ███╗   ███╗ ██████╗██████╗      ██████╗██╗      █████╗ ██╗    ██╗',
    '  ████╗ ████║██╔════╝██╔══██╗    ██╔════╝██║     ██╔══██╗██║    ██║',
    '  ██╔████╔██║██║     ██████╔╝    ██║     ██║     ███████║██║ █╗ ██║',
    '  ██║╚██╔╝██║██║     ██╔═══╝     ██║     ██║     ██╔══██║██║███╗██║',
    '  ██║ ╚═╝ ██║╚██████╗██║         ╚██████╗███████╗██║  ██║╚███╔███╔╝',
    '  ╚═╝     ╚═╝ ╚═════╝╚═╝          ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ '
  ];

  console.log('');
  for (const line of logo) {
    console.log(chalk.cyan(line));
  }
  console.log('');
  console.log(
    chalk.white('  AI-powered MCP Server Generator') + '  ·  ' + chalk.yellow('by SGA 中文社区')
  );
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log('  ' + chalk.gray('Model') + '  ' + chalk.green(config.model));
  const keyStatus = config.apiKey
    ? chalk.green('sk-or-...' + config.apiKey.slice(-4))
    : chalk.red('未配置 (mcp-claw config set-env --key YOUR_KEY)');
  console.log('  ' + chalk.gray('Key') + '    ' + keyStatus);
  console.log(chalk.gray('  /help · /model · /history · /clear · Ctrl+C 退出'));
  console.log('');
}

function printRestoredHistory(session: ChatSession): void {
  const count = session.restoredCount;
  if (count === 0) {
    return;
  }
  const turns = Math.floor(count / 2);
  console.log(`  ${chalk.dim('↻')} ${chalk.gray(`已恢复上次对话 (${turns} 轮)`)}`);

  const rounds = session.getRecentRounds(3);
  if (rounds.length > 0) {
    console.log(chalk.gray('  ' + '─'.repeat(50)));
    for (const round of rounds) {
      const userPreview = round.userText.replace(/\s+/g, ' ').slice(0, 60);
      const assistantPreview = round.assistantText.replace(/\s+/g, ' ').slice(0, 70);
      const toolNote = round.toolCount > 0 ? chalk.dim(` [${round.toolCount} 工具]`) : '';
      console.log(
        `  ${chalk.cyan('你')}  ${chalk.white(userPreview)}${round.userText.length > 60 ? chalk.dim('…') : ''}`
      );
      if (assistantPreview) {
        console.log(
          `  ${chalk.green('助手')} ${chalk.dim(assistantPreview)}${round.assistantText.length > 70 ? chalk.dim('…') : ''}${toolNote}`
        );
      } else if (round.toolCount > 0) {
        console.log(`  ${chalk.green('助手')}${toolNote}`);
      }
    }
    console.log(chalk.gray('  ' + '─'.repeat(50)));
  }
  console.log('');
}

/** Track current model ID for the picker highlight */
let activeModelId = '';

export async function startChatLoop(config: ChatConfig): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const session = new ChatSession(config);
  activeModelId = config.model;

  printBanner(config);
  printRestoredHistory(session);

  const handleSigint = () => {
    rl.close();
    process.exit(0);
  };
  process.on('SIGINT', handleSigint);

  const prompt = chalk.cyan.bold('❯ ');
  const separator = chalk.gray('  ' + '─'.repeat(50));

  try {
    for (;;) {
      const input = await rl.question(prompt);
      const trimmed = input.trim();
      if (!trimmed) {
        continue;
      }

      // Handle slash commands
      if (trimmed === '/clear') {
        session.clearHistory();
        console.log(`  ${chalk.green('✓')} ${chalk.gray('对话已清除')}\n`);
        continue;
      }

      if (trimmed === '/model' || trimmed === '/models') {
        const picked = await pickModel(rl, activeModelId);
        if (picked) {
          activeModelId = picked;
          session.setModel(picked);
          console.log(`  ${chalk.green('✓')} 模型已切换: ${chalk.green(picked)}\n`);
        } else {
          console.log(`  ${chalk.gray('已取消')}\n`);
        }
        continue;
      }

      // /model <alias|id> — quick switch without picker
      if (trimmed.startsWith('/model ')) {
        const arg = trimmed.slice('/model '.length).trim();
        if (!arg) {
          console.log(`  ${chalk.yellow('用法: /model 或 /model <别名>')}\n`);
          continue;
        }
        const found = MODEL_PRESETS.find((m) => m.alias === arg);
        const modelId = found ? found.id : arg;
        activeModelId = modelId;
        session.setModel(modelId);
        console.log(`  ${chalk.green('✓')} 模型已切换: ${chalk.green(modelId)}\n`);
        continue;
      }

      console.log(separator);
      try {
        await session.send(trimmed);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`\n  ${chalk.red('✗')} ${chalk.red(msg)}`);
        if (error instanceof Error && error.cause) {
          console.error(`    ${chalk.gray((error.cause as Error).message ?? String(error.cause))}`);
        }
        console.error('');
      }
    }
  } finally {
    process.off('SIGINT', handleSigint);
    rl.close();
  }
}
