#!/usr/bin/env node
import chalk from 'chalk';

export * from './cli';
export * from './loop/loop.types';
export * from './loop/agent-loop.state-machine';
export * from './loop/agent-loop.engine';
export * from './tools/tool-registry';
export * from './tools/fs-tool';
export * from './tools/docker-tool';
export * from './tools/http-tool';
export * from './llm/llm-client';
export * from './commands/config.command';
export * from './commands/login.command';
export * from './commands/logout.command';
export * from './commands/memory.command';
export * from './utils/auth';
export * from './agents/explorer/explorer.agent';
export * from './agents/architect/ir-generator';
export * from './agents/architect/shard-planner';
export * from './agents/architect/config-generator';
export * from './agents/architect/architect.agent';
export * from './agents/builder/builder.agent';
export * from './agents/tester/tester.agent';
export * from './agents/deployer/deployer.agent';
export * from './memory/memory-store';
export * from './memory/run-record';
export * from './memory/session-reader';
export * from './memory/session-log';
export * from './memory/session-writer';
export * from './agents/sync/sync.agent';
export * from './agents/sync/hub-api-client';

if (require.main === module) {
  import('./cli')
    .then(({ main }) => main(process.argv))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(message));
      process.exitCode = 1;
    });
}
