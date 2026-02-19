#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import { registerConfigCommand } from './commands/config.command';
import { generateCommand } from './commands/generate.command';
import { registerLoginCommand } from './commands/login.command';
import { registerLogoutCommand } from './commands/logout.command';
import { registerMemoryCommand } from './commands/memory.command';
import { registerPublishCommand } from './commands/publish.command';
import { runCommand } from './commands/run.command';

export function createCli(): Command {
  const program = new Command();

  program.name('sga').description('SGA — MCP Server Generator').version('0.2.0');

  program
    .command('run')
    .description('Run MCP Claw agent loop')
    .requiredOption('--root <path>', 'Workspace root path')
    .option('--report-to <url>', 'Backend URL for progress reporting')
    .action(async (options: { root: string; reportTo?: string }) => {
      await runCommand({ root: options.root, logger: console, reportTo: options.reportTo });
    });

  program
    .command('generate <source>')
    .description('Generate an MCP server from a folder or URL')
    .option('-o, --output <dir>')
    .option('--publish')
    .action(async (source: string, options: { output?: string; publish?: boolean }) => {
      await generateCommand({
        source,
        output: options.output,
        publish: options.publish,
        logger: console
      });
    });

  registerConfigCommand(program);
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerMemoryCommand(program);
  registerPublishCommand(program);

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
