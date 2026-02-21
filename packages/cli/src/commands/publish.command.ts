import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import type { Package } from '@sga/shared';
import { getMarketUrl, getToken } from '../utils/auth';

interface ManifestCredential {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

interface PublishManifest {
  name?: string;
  version?: string;
  category?: string;
  description?: string;
  toolsCount?: number;
  credentials?: ManifestCredential[];
}

interface PublishOptions {
  name?: string;
  version?: string;
  category?: string;
  description?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'generated-package';
}

async function createTarball(dir: string): Promise<Buffer> {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-publish-'));
  const tarPath = path.join(tmpDir, 'package.tgz');
  try {
    execSync(
      `tar czf "${tarPath}" --exclude=node_modules --exclude=dist --exclude=.git -C "${dir}" .`,
      { windowsHide: true, timeout: 30000 }
    );
    return readFileSync(tarPath);
  } finally {
    try {
      unlinkSync(tarPath);
    } catch {
      /* cleanup */
    }
    try {
      rmdirSync(tmpDir);
    } catch {
      /* cleanup */
    }
  }
}

function readManifest(cwd: string = process.cwd()): PublishManifest {
  const manifestPath = path.join(cwd, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json not found at ${manifestPath}`);
  }

  const raw = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('manifest.json must contain a JSON object');
  }

  const candidate = parsed as Partial<PublishManifest>;
  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    version: typeof candidate.version === 'string' ? candidate.version : undefined,
    category: typeof candidate.category === 'string' ? candidate.category : undefined,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    toolsCount: typeof candidate.toolsCount === 'number' ? candidate.toolsCount : undefined,
    credentials: Array.isArray(candidate.credentials)
      ? (candidate.credentials as ManifestCredential[])
      : undefined
  };
}

function resolvePublishPayload(
  manifest: PublishManifest,
  options: PublishOptions
): {
  name: string;
  version: string;
  category: string;
  description: string;
  toolsCount?: number;
  credentials?: ManifestCredential[];
} {
  const name = options.name ?? manifest.name;
  const version = options.version ?? manifest.version;
  const category = options.category ?? manifest.category ?? 'other';
  const description = options.description ?? manifest.description ?? '';

  if (!name || !version) {
    throw new Error('name and version are required (from options or manifest.json)');
  }

  return {
    name,
    version,
    category,
    description,
    toolsCount: manifest.toolsCount,
    credentials: manifest.credentials
  };
}

export interface PublishResult {
  name: string;
  version: string;
  marketUrl: string;
  packageUrl: string;
}

export async function publishCommand(
  options: PublishOptions,
  cwd: string = process.cwd()
): Promise<PublishResult> {
  const token = getToken();
  if (!token) {
    throw new Error('Not logged in. Run `mcp-claw login` first.');
  }

  const marketUrl = normalizeBaseUrl(getMarketUrl());
  const manifest = readManifest(cwd);
  const payload = resolvePublishPayload(manifest, options);
  const tarball = await createTarball(cwd);
  const sha256 = createHash('sha256').update(tarball).digest('hex');
  const packageId = slugify(`${payload.name}-${payload.version}`);

  const packageObj: Package = {
    id: packageId,
    name: payload.name,
    version: payload.version,
    description: payload.description || '',
    category: payload.category,
    toolCount: payload.toolsCount ?? 0,
    serverCount: 1,
    sha256,
    signed: false,
    downloads: 0,
    publishedAt: new Date().toISOString(),
    ...(payload.credentials ? { credentials: payload.credentials } : {})
  };

  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(tarball)], { type: 'application/gzip' }),
    `${packageId}.tgz`
  );
  form.append(
    'metadata',
    JSON.stringify({
      packageId,
      manifest: packageObj,
      autoDeploy: false
    })
  );

  const response = await fetch(`${marketUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Publish failed: HTTP ${response.status} ${text}`);
  }

  const packageUrl = `${marketUrl}/repository`;
  console.log(chalk.green(`Published package ${payload.name}@${payload.version}`));
  console.log(chalk.cyan(`View at: ${packageUrl}`));

  return { name: payload.name, version: payload.version, marketUrl, packageUrl };
}

export function registerPublishCommand(program: Command): void {
  program
    .command('publish')
    .description('Publish local manifest.json to SGA Market')
    .option('--name <name>', 'Override package name')
    .option('--version <version>', 'Override package version')
    .option('--category <category>', 'Override package category')
    .option('--description <description>', 'Override package description')
    .action(async (options: PublishOptions) => {
      await publishCommand(options);
    });
}
