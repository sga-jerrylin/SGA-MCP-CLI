import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { runCommand } from './run.command';

export interface GenerateCommandInput {
  source: string;
  output?: string;
  publish?: boolean;
  dryRun?: boolean;
  logger?: Pick<Console, 'log'>;
}

export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function generateCommand(input: GenerateCommandInput): Promise<void> {
  const logger = input.logger ?? console;
  const source = input.source;

  let root: string;
  let urls: string[];

  if (isUrl(source)) {
    root = input.output ? resolve(input.output) : resolve(process.cwd(), 'generated-mcp');
    urls = [source];
  } else {
    root = resolve(source);
    if (!existsSync(root)) {
      throw new Error(`Source path not found: ${root}`);
    }
    urls = [];
  }

  await runCommand({
    root,
    urls,
    logger,
    dryRun: input.dryRun
  });

  if (input.publish) {
    logger.log('Publish requested. Use `sga publish` after generation completes.');
  }
}
