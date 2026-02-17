#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import { runCommand } from './commands/run.command';

export function createCli(): Command {
  const program = new Command();

  program.name('mcp-claw').description('MCP Claw CLI Agent').version('0.1.0');

  program
    .command('run')
    .description('Run MCP Claw agent loop')
    .requiredOption('--root <path>', 'Workspace root path')
    .action(async (options: { root: string }) => {
      await runCommand({ root: options.root, logger: console });
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(argv);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exitCode = 1;
  });
}
