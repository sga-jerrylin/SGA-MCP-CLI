import { createInterface } from 'node:readline/promises';

import { Command } from 'commander';

import { SgaConfig } from '../config/sga-config';
import { generateCommand, isUrl } from './generate.command';
import { publishCommand } from './publish.command';

interface SearchResultRow {
  title?: string;
  url?: string;
}

interface SearchResponsePayload {
  results?: SearchResultRow[];
}

function looksLikeFilePath(input: string): boolean {
  return /[\\/]/.test(input) || /\.[A-Za-z0-9]+$/.test(input);
}

function toSearchEndpoint(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  return `${parsed.protocol}//${parsed.host}/v1/agent/search`;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function discoverSourceByName(name: string): Promise<string | null> {
  const config = new SgaConfig();
  const configured = config.get('search.url');
  const searchBase =
    typeof configured === 'string' && configured.trim().length > 0
      ? configured.trim()
      : process.env.SEARCH_ENGINE_URL?.trim();

  if (!searchBase) {
    return null;
  }

  let endpoint: string;
  try {
    endpoint = toSearchEndpoint(searchBase);
  } catch {
    return null;
  }

  const searchUrl = new URL(endpoint);
  searchUrl.searchParams.set('q', `${name} API documentation`);
  searchUrl.searchParams.set('preset', 'general');
  searchUrl.searchParams.set('limit', '3');

  const response = await fetch(searchUrl.toString(), { method: 'GET' });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SearchResponsePayload;
  const firstUrl = payload.results?.find(
    (row) => typeof row.url === 'string' && row.url.length > 0
  )?.url;

  return typeof firstUrl === 'string' ? firstUrl : null;
}

export async function installCommand(name: string): Promise<void> {
  const input = name.trim();

  let source: string;
  if (isUrl(input)) {
    source = input;
  } else if (looksLikeFilePath(input)) {
    source = input;
  } else {
    const discovered = await discoverSourceByName(input).catch(() => null);
    if (discovered) {
      source = discovered;
      console.log(`Auto-discovered docs URL: ${source}`);
    } else {
      const manual = await ask('Could not auto-discover docs. Please provide the API docs URL: ');
      if (!manual) {
        throw new Error('Install aborted: no docs URL provided.');
      }
      source = manual;
    }
  }

  const result = await generateCommand({ source, logger: console });
  console.log(`Generation completed. Output directory: ${result.root}`);

  const publishAnswer = await ask('Publish to MCP Market? (y/N) ');
  if (/^y(es)?$/i.test(publishAnswer)) {
    await publishCommand({}, result.root);
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command('install <name>')
    .description('Generate an MCP server from an API name, URL, or local file')
    .action(async (name: string) => {
      await installCommand(name);
    });
}
