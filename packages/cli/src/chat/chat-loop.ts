import * as readline from 'node:readline/promises';
import chalk from 'chalk';

import { SgaConfig } from '../config/sga-config';
import {
  getApiKeyConfigKey,
  getBaseUrlForProvider,
  getKeyHintText,
  getKeyPromptText,
  getProviderForModel,
  type ModelProvider
} from '../llm/provider-routing';
import type { ChatConfig } from './chat-types';
import { ChatSession } from './chat-session';

const MODEL_PRESETS: Array<{ alias: string; id: string; label: string; provider: ModelProvider }> =
  [
    {
      alias: 'gemini-flash',
      id: 'google/gemini-3-flash-preview',
      label: 'Gemini 3 Flash',
      provider: 'openrouter'
    },
    {
      alias: 'qwen3-coder',
      id: 'qwen3-coder-plus',
      label: 'Qwen3 Coder+',
      provider: 'coding-plan'
    },
    {
      alias: 'qwen3-next',
      id: 'qwen3-coder-next',
      label: 'Qwen3 Coder Next',
      provider: 'coding-plan'
    },
    { alias: 'qwen3-max', id: 'qwen3-max', label: 'Qwen3 Max', provider: 'coding-plan' },
    { alias: 'qwen3.5', id: 'qwen3.5-plus', label: 'Qwen3.5 Plus', provider: 'coding-plan' },
    { alias: 'glm-5', id: 'glm-5', label: 'GLM-5 智谱', provider: 'coding-plan' },
    { alias: 'glm-4.7', id: 'glm-4.7', label: 'GLM-4.7 智谱', provider: 'coding-plan' },
    { alias: 'kimi-k2.5', id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'coding-plan' },
    { alias: 'minimax', id: 'minimax-m2.5', label: 'MiniMax M2.5', provider: 'coding-plan' }
  ];

function createRl(): readline.Interface {
  // Ensure stdin is in flowing mode and referenced so the event loop stays alive
  process.stdin.resume();
  if (typeof process.stdin.ref === 'function') {
    process.stdin.ref();
  }
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function pickModel(rl: readline.Interface, currentModelId: string): Promise<string | null> {
  return new Promise((resolve) => {
    rl.pause();
    const stdin = process.stdin;
    const stdout = process.stdout;

    const wasRaw = stdin.isRaw;
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();

    let cursor = Math.max(
      0,
      MODEL_PRESETS.findIndex((model) => model.id === currentModelId)
    );
    const total = MODEL_PRESETS.length;

    const draw = () => {
      stdout.write(
        `\n  ${chalk.white.bold('Select model')} ${chalk.gray('(↑/↓ choose, Enter confirm, Esc cancel)')}\n`
      );
      for (let i = 0; i < total; i += 1) {
        const item = MODEL_PRESETS[i];
        const selected = i === cursor;
        const marker = selected ? chalk.cyan('>') : ' ';
        const alias = selected ? chalk.cyan.bold(item.alias) : chalk.white(item.alias);
        const label = selected ? chalk.white(item.label) : chalk.gray(item.label);
        const id = chalk.gray.dim(item.id);
        const tag = item.provider === 'coding-plan' ? chalk.yellow('[国内]') : chalk.blue('[海外]');
        stdout.write(
          `  ${marker} ${alias.padEnd(16)} ${label.padEnd(20)} ${id.padEnd(32)} ${tag}\n`
        );
      }
      stdout.write(`  ${chalk.gray('-'.repeat(78))}\n`);
    };

    const redraw = () => {
      stdout.write(`\x1b[${total + 3}A`);
      draw();
    };

    const cleanup = () => {
      stdin.removeListener('data', onKey);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(wasRaw ?? false);
      }
      // Do NOT call stdin.pause() here — on Windows it can leave stdin
      // in a fragile state that causes readline to fail on next question.
      // Instead, keep stdin flowing and let readline resume normally.
      stdin.resume();
      rl.resume();
    };

    const onKey = (data: Buffer) => {
      const key = data.toString();

      if (key === '\x1b' || key === '\x03') {
        cleanup();
        resolve(null);
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(MODEL_PRESETS[cursor].id);
        return;
      }

      if (key === '\x1b[A' || key === 'k') {
        cursor = (cursor - 1 + total) % total;
        redraw();
        return;
      }

      if (key === '\x1b[B' || key === 'j') {
        cursor = (cursor + 1) % total;
        redraw();
        return;
      }

      const num = Number.parseInt(key, 10);
      if (Number.isInteger(num) && num >= 1 && num <= total) {
        cursor = num - 1;
        redraw();
      }
    };

    draw();
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

  const providerLabel =
    config.provider === 'coding-plan'
      ? chalk.yellow('国内 · Coding Plan')
      : chalk.blue('海外 · OpenRouter');
  console.log('  ' + chalk.gray('Provider') + ' ' + providerLabel);
  console.log('  ' + chalk.gray('Model   ') + ' ' + chalk.green(config.model));

  let keyStatus: string;
  if (config.apiKey) {
    const prefix = config.provider === 'coding-plan' ? 'sk-sp-' : 'sk-or-';
    keyStatus = chalk.green(prefix + '...' + config.apiKey.slice(-4));
  } else {
    const hint =
      config.provider === 'coding-plan'
        ? 'config set coding-plan.apiKey YOUR_KEY'
        : 'config set openrouter.apiKey YOUR_KEY';
    keyStatus = chalk.red('未配置 (mcp-claw ' + hint + ')');
  }
  console.log('  ' + chalk.gray('Key     ') + ' ' + keyStatus);
  console.log(chalk.gray('  /help · /model · /history · /clear · Ctrl+C 退出'));
  console.log('');
}

function printRestoredHistory(session: ChatSession): void {
  const count = session.restoredCount;
  if (count === 0) {
    return;
  }

  const turns = Math.floor(count / 2);
  console.log(`  ${chalk.dim('->')} ${chalk.gray(`restored previous chat (${turns} turns)`)}`);

  const rounds = session.getRecentRounds(3);
  if (rounds.length > 0) {
    console.log(chalk.gray('  ' + '-'.repeat(50)));
    for (const round of rounds) {
      const userPreview = round.userText.replace(/\s+/g, ' ').slice(0, 60);
      const assistantPreview = round.assistantText.replace(/\s+/g, ' ').slice(0, 70);
      const toolNote = round.toolCount > 0 ? chalk.dim(` [${round.toolCount} tools]`) : '';
      console.log(
        `  ${chalk.cyan('you')}  ${chalk.white(userPreview)}${round.userText.length > 60 ? chalk.dim('...') : ''}`
      );
      if (assistantPreview) {
        console.log(
          `  ${chalk.green('bot')}  ${chalk.dim(assistantPreview)}${round.assistantText.length > 70 ? chalk.dim('...') : ''}${toolNote}`
        );
      } else if (round.toolCount > 0) {
        console.log(`  ${chalk.green('bot')}${toolNote}`);
      }
    }
    console.log(chalk.gray('  ' + '-'.repeat(50)));
  }

  console.log('');
}

let activeModelId = '';

/**
 * Switch to a new model, prompting for API key if the provider changes.
 * Returns the updated ChatConfig on success, or null if the user cancelled.
 */
async function switchModel(
  modelId: string,
  config: ChatConfig,
  session: ChatSession,
  rl: readline.Interface
): Promise<ChatConfig | null> {
  const targetProvider = getProviderForModel(modelId);
  let newApiKey = config.apiKey;
  let newBaseUrl = config.baseUrl;

  if (targetProvider !== config.provider) {
    const switchConf = new SgaConfig();
    const stored = switchConf.get(getApiKeyConfigKey(targetProvider));
    const existing = typeof stored === 'string' ? stored.trim() : '';

    if (existing) {
      newApiKey = existing;
    } else {
      console.log('');
      console.log(chalk.gray(getKeyHintText(targetProvider)));
      console.log('');
      let k = '';
      try {
        k = (await rl.question(getKeyPromptText(targetProvider))).trim();
      } catch {
        k = '';
      }
      if (!k) {
        console.log(chalk.yellow('  未输入 key，取消切换。'));
        return null;
      }
      switchConf.set(getApiKeyConfigKey(targetProvider), k);
      newApiKey = k;
    }
    newBaseUrl = getBaseUrlForProvider(targetProvider);
  }

  const saveConf = new SgaConfig();
  saveConf.set('model.coder', modelId);
  session.setModel(modelId, newApiKey, newBaseUrl);

  return {
    ...config,
    model: modelId,
    apiKey: newApiKey,
    baseUrl: newBaseUrl,
    provider: targetProvider
  };
}

export async function startChatLoop(initialConfig: ChatConfig): Promise<void> {
  let config = initialConfig;
  const rlRef = { rl: createRl() };

  // --- Global safety nets ---
  // Prevent unhandled promise rejections from silently killing the process
  const rejectionHandler = (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error(`\n  ${chalk.red('unhandled rejection')} ${chalk.red(msg)}\n`);
  };
  process.on('unhandledRejection', rejectionHandler);

  // Catch uncaught exceptions — log but don't let them kill the process
  const exceptionHandler = (err: Error) => {
    console.error(`\n  ${chalk.red('uncaught exception')} ${chalk.red(err.message)}\n`);
  };
  process.on('uncaughtException', exceptionHandler);

  // Diagnostic: log any process exit to understand unexpected exits
  const exitHandler = (code: number) => {
    if (code !== 0) {
      console.error(chalk.dim(`  [exit code ${code}]`));
    }
  };
  process.on('exit', exitHandler);

  if (!config.apiKey) {
    console.log(chalk.yellow('\n  首次使用 — 请先选择模型（系统自动匹配 API 提供商）\n'));

    const pickedFirst = await pickModel(rlRef.rl, config.model);
    if (!pickedFirst) {
      console.log(chalk.red('  未选择模型，请重新运行。'));
      rlRef.rl.close();
      cleanup();
      return;
    }

    const firstProvider = getProviderForModel(pickedFirst);
    const firstBaseUrl = getBaseUrlForProvider(firstProvider);

    console.log('');
    console.log(chalk.gray(getKeyHintText(firstProvider)));
    console.log('');

    let firstKey = '';
    try {
      firstKey = (await rlRef.rl.question(getKeyPromptText(firstProvider))).trim();
    } catch {
      rlRef.rl.close();
      cleanup();
      return;
    }

    if (!firstKey) {
      console.log(chalk.red('  API key 不能为空，请重新运行。'));
      rlRef.rl.close();
      cleanup();
      return;
    }

    const sgaConfigFirst = new SgaConfig();
    sgaConfigFirst.set(getApiKeyConfigKey(firstProvider), firstKey);
    sgaConfigFirst.set('model.coder', pickedFirst);

    config = {
      ...config,
      model: pickedFirst,
      apiKey: firstKey,
      baseUrl: firstBaseUrl,
      provider: firstProvider
    };
    console.log(chalk.green('  已保存到 ~/.sga/config.yaml\n'));
  }
  const session = new ChatSession(config);
  activeModelId = config.model;

  printBanner(config);
  printRestoredHistory(session);

  // --- SIGINT handling ---
  // CRITICAL FIX: Do NOT call process.exit() in the SIGINT handler.
  // On Windows, child_process.exec() can propagate CTRL_C_EVENT to the parent,
  // which triggers SIGINT and immediately kills the process via process.exit(0).
  // Instead: track SIGINT count. First press during send() is ignored (child signal noise).
  // Only honor SIGINT when we're actually waiting for user input at the prompt.
  let sigintCount = 0;
  let insideSend = false;

  const handleSigint = () => {
    if (insideSend) {
      // During tool execution, SIGINT likely came from a child process signal propagation.
      // Ignore it — the tool execution has its own timeout handling.
      sigintCount = 0;
      return;
    }

    sigintCount++;
    if (sigintCount >= 2) {
      // User pressed Ctrl+C twice at the prompt — they really want to exit
      console.log(chalk.gray('\n  bye.\n'));
      rlRef.rl.close();
      process.exit(0);
    }

    // First Ctrl+C at the prompt — close readline gracefully (no process.exit)
    console.log(chalk.gray('\n  (Ctrl+C again to exit)\n'));
    // Write a new prompt so the user sees we're still alive
    process.stdout.write(chalk.cyan.bold('> '));
  };
  process.on('SIGINT', handleSigint);

  const prompt = chalk.cyan.bold('> ');
  const separator = chalk.gray('  ' + '-'.repeat(50));

  function cleanup(): void {
    process.off('SIGINT', handleSigint);
    process.off('unhandledRejection', rejectionHandler);
    process.off('uncaughtException', exceptionHandler);
    process.off('exit', exitHandler);
  }

  try {
    for (;;) {
      // Reset SIGINT counter before each prompt
      sigintCount = 0;

      // Ensure stdin is alive before asking
      if (process.stdin.destroyed || !process.stdin.readable) {
        console.error(chalk.red('\n  stdin destroyed, cannot continue.\n'));
        break;
      }
      process.stdin.resume();
      if (typeof process.stdin.ref === 'function') {
        process.stdin.ref();
      }

      let input: string;
      try {
        input = await rlRef.rl.question(prompt);
      } catch {
        // readline failed — try to recreate
        try {
          rlRef.rl.close();
        } catch {
          /* ignore */
        }

        // Check if stdin itself is dead
        if (process.stdin.destroyed || !process.stdin.readable) {
          console.error(chalk.red('\n  stdin closed, exiting.\n'));
          break;
        }

        console.error(chalk.yellow('\n  readline reset, retrying...\n'));
        rlRef.rl = createRl();

        try {
          input = await rlRef.rl.question(prompt);
        } catch {
          console.error(chalk.red('\n  readline unrecoverable, exiting.\n'));
          break;
        }
      }

      const trimmed = input.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed === '/help') {
        console.log(chalk.gray('  /help | /model | /model <alias|id> | /history | /clear'));
        console.log('');
        continue;
      }

      if (trimmed === '/clear') {
        session.clearHistory();
        console.log(`  ${chalk.green('ok')} ${chalk.gray('history cleared')}\n`);
        continue;
      }

      if (trimmed === '/history') {
        printRestoredHistory(session);
        continue;
      }

      if (trimmed === '/model' || trimmed === '/models') {
        const picked = await pickModel(rlRef.rl, activeModelId);
        if (picked) {
          const switchResult = await switchModel(picked, config, session, rlRef.rl);
          if (switchResult) {
            config = switchResult;
            activeModelId = picked;
            console.log(`  ${chalk.green('ok')} model switched to ${chalk.green(picked)}\n`);
          } else {
            console.log(`  ${chalk.gray('cancelled')}\n`);
          }
        } else {
          console.log(`  ${chalk.gray('cancelled')}\n`);
        }
        continue;
      }

      if (trimmed.startsWith('/model ')) {
        const arg = trimmed.slice('/model '.length).trim();
        if (!arg) {
          console.log(`  ${chalk.yellow('usage: /model <alias|id>')}\n`);
          continue;
        }
        const found = MODEL_PRESETS.find((m) => m.alias === arg);
        const modelId = found ? found.id : arg;
        const switchResult = await switchModel(modelId, config, session, rlRef.rl);
        if (switchResult) {
          config = switchResult;
          activeModelId = modelId;
          console.log(`  ${chalk.green('ok')} model switched to ${chalk.green(modelId)}\n`);
        } else {
          console.log(`  ${chalk.gray('cancelled')}\n`);
        }
        continue;
      }

      console.log(separator);

      // Mark that we're inside send() — SIGINT from child processes should be ignored
      insideSend = true;
      try {
        await session.send(trimmed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\n  ${chalk.red('error')} ${chalk.red(message)}`);
        if (error instanceof Error && error.cause) {
          console.error(`    ${chalk.gray((error.cause as Error).message ?? String(error.cause))}`);
        }
        console.error('');
      } finally {
        insideSend = false;
      }
    }
  } finally {
    cleanup();
    rlRef.rl.close();
  }
}
