import readline from 'node:readline';
import { Command } from 'commander';
import chalk from 'chalk';

import { getMarketUrl, saveToken } from '../utils/auth';

interface LoginOptions {
  token?: string;
}

function normalizeMarketUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function verifyToken(marketUrl: string, token: string): Promise<void> {
  const url = `${normalizeMarketUrl(marketUrl)}/auth/verify`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Token verification failed (${response.status}): ${message}`);
  }
}

function promptHiddenToken(prompt = 'Token: '): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    const hidden = rl as readline.Interface & {
      stdoutMuted?: boolean;
      _writeToOutput?: (value: string) => void;
    };

    hidden.stdoutMuted = false;
    hidden._writeToOutput = (value: string): void => {
      if (hidden.stdoutMuted) {
        process.stdout.write('*');
        return;
      }
      process.stdout.write(value);
    };

    hidden.stdoutMuted = false;
    rl.question(prompt, (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(value.trim());
    });
    hidden.stdoutMuted = true;
  });
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const marketUrl = getMarketUrl();
  const token = options.token?.trim() || (await promptHiddenToken());

  if (!token) {
    console.error(chalk.red('Token is required.'));
    process.exitCode = 1;
    return;
  }

  try {
    await verifyToken(marketUrl, token);
    saveToken(token, marketUrl);
    console.log(chalk.green('登录成功'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exitCode = 1;
  }
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Login to MCP Market')
    .option('--token <token>', 'Access token')
    .action(async (options: LoginOptions) => {
      await runLogin(options);
    });
}
