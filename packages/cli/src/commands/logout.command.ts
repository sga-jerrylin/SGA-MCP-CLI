import { Command } from 'commander';
import chalk from 'chalk';

import { clearToken } from '../utils/auth';

export function runLogout(): void {
  clearToken();
  console.log(chalk.green('已退出登录'));
}

export function registerLogoutCommand(program: Command): void {
  program.command('logout').description('Logout from MCP Market').action(() => {
    runLogout();
  });
}

