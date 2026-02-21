import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

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

export interface GenerateCommandResult {
  root: string;
}

/**
 * Derive a project directory name from the source.
 *   AGENT_API.md        → mcp-server-agent-api
 *   stripe_docs.yaml    → mcp-server-stripe-docs
 *   https://api.x.com/docs → mcp-server-api-x-com
 */
function deriveProjectName(source: string): string {
  let raw: string;

  if (isUrl(source)) {
    try {
      const url = new URL(source);
      // hostname + first path segment: api.stripe.com/docs → api-stripe-com-docs
      const host = url.hostname.replace(/^www\./, '');
      const firstPath = url.pathname.split('/').filter(Boolean)[0] ?? '';
      raw = firstPath ? `${host}-${firstPath}` : host;
    } catch {
      raw = 'api';
    }
  } else {
    // Strip extension: AGENT_API.md → AGENT_API
    raw = basename(source, extname(source));
  }

  const kebab = raw
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `mcp-server-${kebab || 'generated'}`;
}

export async function generateCommand(input: GenerateCommandInput): Promise<GenerateCommandResult> {
  const logger = input.logger ?? console;
  const source = input.source;

  let root: string;
  let urls: string[];
  let rawDocs: string[] | undefined;

  if (isUrl(source)) {
    const projectName = deriveProjectName(source);
    root = input.output ?? resolve(process.cwd(), projectName);
    urls = [source];
  } else {
    const resolved = resolve(source);
    if (!existsSync(resolved)) {
      throw new Error(`Source path not found: ${resolved}`);
    }
    if (statSync(resolved).isFile()) {
      const projectName = deriveProjectName(resolved);
      root = input.output ?? resolve(dirname(resolved), projectName);
      rawDocs = [readFileSync(resolved, 'utf8')];
      urls = [];
    } else {
      root = input.output ?? resolved;
      urls = [];
    }
  }

  await runCommand({
    root,
    urls,
    rawDocs,
    logger,
    dryRun: input.dryRun
  });

  if (input.publish) {
    logger.log('Publish requested. Use `sga publish` after generation completes.');
  }

  return { root };
}
