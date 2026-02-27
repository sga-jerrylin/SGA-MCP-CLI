import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { Command } from 'commander';
import chalk from 'chalk';
import type { Package } from '@sga/shared';
import { IntegrationTester } from '../agents/tester/integration-tester';
import { loadChatConfig } from '../chat/chat-config';
import { OpenRouterProvider } from '../llm/llm-client';
import { getMarketUrl, getToken } from '../utils/auth';

interface ManifestCredential {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

interface ManifestTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface PublishManifest {
  name?: string;
  version?: string;
  category?: string;
  description?: string;
  toolsCount?: number;
  tools?: ManifestTool[];
  credentials?: ManifestCredential[];
}

interface PublishOptions {
  name?: string;
  version?: string;
  category?: string;
  description?: string;
  enhance?: boolean;
}

type ManifestSchemaVersion = 'v2' | 'legacy';
const SKIP_VARS = new Set(['NODE_ENV', 'PORT', 'HTTP_TIMEOUT_MS', 'DEBUG', 'LOG_LEVEL']);

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
  const archiverModule = (await import('archiver')) as {
    default: (
      format: 'tar',
      options: { gzip: boolean }
    ) => {
      on: (event: 'error', handler: (error: Error) => void) => void;
      pipe: (destination: Writable) => void;
      directory: (source: string, destination: false | string) => void;
      finalize: () => Promise<void>;
    };
  };

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      }
    });
    const archive = archiverModule.default('tar', { gzip: true });
    archive.on('error', reject);
    writable.on('finish', () => resolve(Buffer.concat(chunks)));
    archive.pipe(writable);
    archive.directory(dir, false);
    archive.finalize().catch(reject);
  });
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
  const tools = Array.isArray(candidate.tools)
    ? candidate.tools
        .map((tool) => {
          if (!tool || typeof tool !== 'object') {
            return null;
          }
          const item = tool as Partial<ManifestTool>;
          if (typeof item.name !== 'string' || item.name.trim().length === 0) {
            return null;
          }
          return {
            name: item.name,
            ...(typeof item.description === 'string' ? { description: item.description } : {}),
            ...(item.inputSchema && typeof item.inputSchema === 'object'
              ? { inputSchema: item.inputSchema }
              : {})
          } as ManifestTool;
        })
        .filter((tool): tool is ManifestTool => tool !== null)
    : undefined;

  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    version: typeof candidate.version === 'string' ? candidate.version : undefined,
    category: typeof candidate.category === 'string' ? candidate.category : undefined,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    toolsCount: typeof candidate.toolsCount === 'number' ? candidate.toolsCount : undefined,
    tools,
    credentials: Array.isArray(candidate.credentials)
      ? (candidate.credentials as ManifestCredential[])
      : undefined
  };
}

function hasInputSchema(tool: ManifestTool): boolean {
  if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
    return false;
  }
  return Object.keys(tool.inputSchema).length > 0;
}

function scanSourceEnvVars(cwd: string): string[] {
  const envVarPattern = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  const discovered = new Set<string>();
  const stack = [cwd];
  const sourceExtensions = new Set(['.ts', '.js']);
  const skippedDirs = new Set(['node_modules', 'dist']);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skippedDirs.has(entry.name)) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!sourceExtensions.has(ext)) {
        continue;
      }

      try {
        const content = readFileSync(fullPath, 'utf8');
        for (const match of content.matchAll(envVarPattern)) {
          const varName = match[1];
          if (varName && !SKIP_VARS.has(varName)) {
            discovered.add(varName);
          }
        }
      } catch {
        continue;
      }
    }
  }

  return Array.from(discovered);
}

function mergeDiscoveredCredentials(
  credentials: ManifestCredential[] | undefined,
  discoveredEnvVars: string[]
): ManifestCredential[] | undefined {
  const merged = Array.isArray(credentials) ? [...credentials] : [];
  const existingKeys = new Set(merged.map((item) => item.key));

  for (const varName of discoveredEnvVars) {
    if (SKIP_VARS.has(varName) || existingKeys.has(varName)) {
      continue;
    }

    console.warn(
      chalk.yellow(`[credentials] 发现未声明的 env var: ${varName}，已自动补入 manifest`)
    );
    merged.push({
      key: varName,
      label: varName,
      type: 'string',
      required: true,
      description: `配置 ${varName} 环境变量`
    });
    existingKeys.add(varName);
  }

  return merged.length > 0 ? merged : undefined;
}

function mergeTools(
  manualTools: ManifestTool[] | undefined,
  discoveredTools: ManifestTool[]
): ManifestTool[] {
  if (!manualTools || manualTools.length === 0) {
    return discoveredTools;
  }

  const discoveredByName = new Map(discoveredTools.map((tool) => [tool.name, tool]));
  const merged = manualTools.map((tool) => {
    const discovered = discoveredByName.get(tool.name);
    if (!discovered) {
      return tool;
    }

    return {
      name: tool.name,
      description: tool.description ?? discovered.description,
      inputSchema: hasInputSchema(tool)
        ? tool.inputSchema
        : hasInputSchema(discovered)
          ? discovered.inputSchema
          : tool.inputSchema
    };
  });

  for (const discovered of discoveredTools) {
    if (!merged.some((tool) => tool.name === discovered.name)) {
      merged.push(discovered);
    }
  }

  return merged;
}

async function resolvePublishPayload(
  manifest: PublishManifest,
  options: PublishOptions,
  cwd: string
): Promise<{
  name: string;
  version: string;
  category: string;
  description: string;
  toolsCount?: number;
  tools?: ManifestTool[];
  credentials?: ManifestCredential[];
  manifestSchemaVersion: ManifestSchemaVersion;
}> {
  const name = options.name ?? manifest.name;
  const version = options.version ?? manifest.version;
  const category = options.category ?? manifest.category ?? 'other';
  const description = options.description ?? manifest.description ?? '';

  if (!name || !version) {
    throw new Error('name and version are required (from options or manifest.json)');
  }

  const manualTools = manifest.tools;
  const hasManualSchema =
    Array.isArray(manualTools) && manualTools.length > 0 && manualTools.every(hasInputSchema);

  let tools: ManifestTool[] | undefined = manualTools;
  let manifestSchemaVersion: ManifestSchemaVersion = hasManualSchema ? 'v2' : 'legacy';

  if (!hasManualSchema) {
    try {
      const tester = new IntegrationTester();
      const baseUrl =
        process.env.MCP_PUBLISH_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:8888';
      const report = await tester.run({
        dir: cwd,
        baseUrl,
        authEnv: {}
      });

      const discoveredTools = Array.isArray(report.tools)
        ? report.tools
            .filter((tool) => typeof tool.name === 'string' && tool.name.trim().length > 0)
            .map((tool) => ({
              name: tool.name.trim(),
              ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
              ...(tool.inputSchema && typeof tool.inputSchema === 'object'
                ? { inputSchema: tool.inputSchema }
                : {})
            }))
        : [];

      if (discoveredTools.length > 0) {
        tools = mergeTools(manualTools, discoveredTools);
        const hasExtractedSchema = tools.some(hasInputSchema);
        manifestSchemaVersion = hasExtractedSchema ? 'v2' : 'legacy';
      } else {
        if (report.passed === false) {
          const reason =
            typeof report.error === 'string' && report.error.trim().length > 0
              ? report.error
              : 'unknown reason';
          console.warn(chalk.yellow(`Tool schema extraction skipped: ${reason}`));
        }
        manifestSchemaVersion = 'legacy';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`Tool schema extraction skipped: ${message}`));
      manifestSchemaVersion = 'legacy';
    }
  }

  const discoveredEnvVars = scanSourceEnvVars(cwd);
  const credentials = mergeDiscoveredCredentials(manifest.credentials, discoveredEnvVars);

  return {
    name,
    version,
    category,
    description,
    toolsCount: manifest.toolsCount,
    tools,
    credentials,
    manifestSchemaVersion
  };
}

function estimateToolsCount(srcDir: string): number {
  if (!existsSync(srcDir)) {
    return 0;
  }

  const targetExtensions = new Set(['.ts', '.js', '.py']);
  const patterns = [
    /server\.tool\(/gi,
    /tools\.add\(/gi,
    /addTool\(/gi,
    /@tool/gi,
    /def\s+tool_/gi
  ];
  const stack = [srcDir];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!targetExtensions.has(ext)) {
        continue;
      }

      try {
        const content = readFileSync(fullPath, 'utf8');
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            count += matches.length;
          }
        }
      } catch {
        continue;
      }
    }
  }

  return count;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function autoEnhanceManifest(
  cwd: string,
  payload: {
    name: string;
    version: string;
    category: string;
    description: string;
    toolsCount?: number;
    tools?: ManifestTool[];
    credentials?: ManifestCredential[];
  }
): Promise<Partial<Pick<typeof payload, 'description' | 'category' | 'toolsCount'>>> {
  const chatConfig = loadChatConfig(cwd);
  if (!chatConfig.apiKey) {
    return {};
  }

  const readmePath = path.join(cwd, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8').slice(0, 3000) : '';
  const srcPath = path.join(cwd, 'src');
  const estimatedTools = estimateToolsCount(srcPath);

  const provider = new OpenRouterProvider(
    'publish-enhance',
    chatConfig.model,
    chatConfig.apiKey,
    chatConfig.baseUrl
  );

  const prompt = [
    'You are enhancing MCP package metadata for publishing.',
    'Return JSON only with shape:',
    '{ "description": string, "category": string, "toolsCount": number }',
    "category must be one of ['productivity', 'developer-tools', 'data', 'communication', 'ai', 'security', 'other'].",
    '',
    `Package name: ${payload.name}`,
    `Version: ${payload.version}`,
    `Current category: ${payload.category}`,
    `Current description: ${payload.description || '(empty)'}`,
    `Estimated tools count from source scan: ${estimatedTools}`,
    `Credentials fields count: ${Array.isArray(payload.credentials) ? payload.credentials.length : 0}`,
    '',
    'README excerpt (may be empty):',
    readme || '(empty)',
    '',
    'Rules:',
    '- description should be concise, practical, and at least 20 characters.',
    '- toolsCount should be a non-negative integer.',
    '- If uncertain, choose category "other".'
  ].join('\n');

  const raw = await provider.complete(prompt);
  const parsed = extractJsonObject(raw);
  if (!parsed) {
    return {};
  }

  const description =
    typeof parsed.description === 'string' && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : undefined;

  const category =
    typeof parsed.category === 'string' && parsed.category.trim().length > 0
      ? parsed.category.trim()
      : undefined;

  const toolsCountValue =
    typeof parsed.toolsCount === 'number'
      ? parsed.toolsCount
      : typeof parsed.toolsCount === 'string'
        ? Number(parsed.toolsCount)
        : Number.NaN;
  const toolsCount =
    Number.isFinite(toolsCountValue) && toolsCountValue >= 0
      ? Math.floor(toolsCountValue)
      : estimatedTools > 0
        ? estimatedTools
        : undefined;

  return {
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(typeof toolsCount === 'number' ? { toolsCount } : {})
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
  const payload = await resolvePublishPayload(manifest, options, cwd);

  const shouldEnhance = options.enhance !== false;
  if (shouldEnhance && payload.description.trim().length < 20) {
    try {
      const enhanced = await autoEnhanceManifest(cwd, payload);
      let enhancedApplied = false;

      if (!options.description && enhanced.description) {
        payload.description = enhanced.description;
        enhancedApplied = true;
      }

      if (!options.category && enhanced.category) {
        payload.category = enhanced.category;
        enhancedApplied = true;
      }

      if (typeof payload.toolsCount !== 'number' && typeof enhanced.toolsCount === 'number') {
        payload.toolsCount = enhanced.toolsCount;
        enhancedApplied = true;
      }

      if (enhancedApplied) {
        console.log(chalk.dim('AI enhanced: description + toolsCount'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`AI enhance skipped: ${message}`));
    }
  }

  const tarball = await createTarball(cwd);
  const sha256 = createHash('sha256').update(tarball).digest('hex');
  const packageId = slugify(`${payload.name}-${payload.version}`);

  const packageObj = {
    id: packageId,
    name: payload.name,
    version: payload.version,
    description: payload.description || '',
    category: payload.category,
    toolCount: payload.toolsCount ?? 0,
    manifestSchemaVersion: payload.manifestSchemaVersion,
    ...(payload.tools ? { tools: payload.tools } : {}),
    serverCount: 1,
    sha256,
    signed: false,
    downloads: 0,
    publishedAt: new Date().toISOString(),
    ...(payload.credentials ? { credentials: payload.credentials } : {})
  } as Package & { manifestSchemaVersion?: ManifestSchemaVersion };

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

  const response = await fetch(`${marketUrl}/packages/sync/push`, {
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
    .option('--no-enhance', 'Skip LLM metadata enhancement before upload')
    .action(async (options: PublishOptions) => {
      await publishCommand(options);
    });
}
