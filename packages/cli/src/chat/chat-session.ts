import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import { IntegrationTester } from '../agents/tester/integration-tester';
import { TestRunner } from '../agents/tester/test-runner';
import { generateCommand, isUrl } from '../commands/generate.command';
import { publishCommand } from '../commands/publish.command';
import type { ChatCapableLlmProvider, ChatMessage, ToolCall } from '../llm/llm-client';
import { OpenRouterProvider } from '../llm/llm-client';
import { SessionReader } from '../memory/session-reader';
import { BrowserTool } from '../tools/browser-tool';
import { FsTool } from '../tools/fs-tool';
import { getMarketUrl, getToken, saveToken } from '../utils/auth';
import type { ChatConfig } from './chat-types';
import { buildToolDefinitions, type ChatToolName } from './tool-definitions';

const execFileAsync = promisify(execFile);

const FOLDER_PATTERNS = ['*'];
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.xml',
  '.toml',
  '.env'
]);

const MAX_DOC_FILE_COUNT = 30;
const MAX_SNIPPET_LENGTH = 8000;
const MAX_FILE_READ_LENGTH = 200_000;
const MAX_TEST_OUTPUT = 6000;

interface GitContext {
  isRepo: boolean;
  branch?: string;
  latestCommit?: string;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTextLikeFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function findNearestFile(startDir: string, fileName: string, maxLevels = 6): string | undefined {
  let current = resolve(startDir);

  for (let level = 0; level <= maxLevels; level += 1) {
    const candidate = join(current, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}

async function runGit(workDir: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: workDir,
      windowsHide: true
    });
    const output = stdout.trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}

async function readProjectName(workDir: string): Promise<string | undefined> {
  const packagePath = findNearestFile(workDir, 'package.json');
  if (!packagePath) {
    return undefined;
  }

  try {
    const raw = await readFile(packagePath, 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === 'string' ? parsed.name : undefined;
  } catch {
    return undefined;
  }
}

async function readGitContext(workDir: string): Promise<GitContext> {
  const inside = await runGit(workDir, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    return { isRepo: false };
  }

  const [branch, latestCommit] = await Promise.all([
    runGit(workDir, ['branch', '--show-current']),
    runGit(workDir, ['log', '-1', '--pretty=format:%h %s'])
  ]);

  return {
    isRepo: true,
    branch,
    latestCommit
  };
}

async function buildSystemPrompt(workDir: string): Promise<string> {
  const [projectName, gitCtx] = await Promise.all([
    readProjectName(workDir),
    readGitContext(workDir)
  ]);
  const now = new Date().toISOString();
  const branch = gitCtx.isRepo ? (gitCtx.branch ?? 'detached') : 'n/a';
  const commit = gitCtx.isRepo ? (gitCtx.latestCommit ?? 'n/a') : 'n/a';

  return [
    '# Environment',
    `cwd: ${workDir}`,
    `platform: ${process.platform}`,
    `time: ${now}`,
    `project: ${projectName ?? 'unknown'}`,
    `git: ${branch} | ${commit}`,
    '',
    '# Role',
    'You are mcp-claw, a specialist AI for generating MCP (Model Context Protocol) servers.',
    'You are NOT a generic coding assistant. Your domain is MCP server creation.',
    '',
    '# MCP Protocol Specification',
    '',
    '## Core Primitives',
    'MCP servers expose capabilities to AI hosts (Claude Desktop, Cursor, Windsurf, etc.) via:',
    '',
    '### Tools (functions the AI can invoke)',
    '- name: snake_case, verb_noun pattern (get_user, create_order, list_products)',
    '- description: one-sentence purpose, mention side effects if any',
    '- inputSchema: JSON Schema with required/optional params, each with description',
    '- One tool = one atomic API operation. Do NOT merge multiple endpoints into one tool.',
    '- Return structured JSON. Include relevant fields, not raw API response.',
    '',
    '### Resources (read-only data the AI can access)',
    '- Exposed via URI: resource://users/{id}, resource://config',
    '- Use for reference data, configs, documentation. Use tools for mutations.',
    '',
    '## Server Structure (TypeScript, best practice)',
    '```',
    'src/',
    '  index.ts          # McpServer + StdioServerTransport entry',
    '  tools/            # One file per tool group',
    '    users.ts        # registerUserTools(server, client)',
    '    orders.ts',
    '  lib/',
    '    api-client.ts   # Shared HTTP client: base URL, auth, error handling',
    '    types.ts        # Shared TypeScript interfaces',
    'package.json        # type: "module", bin: { "mcp-server-xxx": "./dist/index.js" }',
    'tsconfig.json       # target: ES2022, module: NodeNext',
    'README.md           # Install, configure, use with Claude/Cursor',
    '```',
    '',
    '## Authentication Patterns',
    '- API Key: read from env var (e.g., XXX_API_KEY), inject into headers',
    '- Bearer Token: env var, Authorization: Bearer ${token}',
    '- OAuth2: implement token refresh, store in memory or file',
    '- NEVER hardcode secrets. Always use env vars: {SERVICE}_API_KEY',
    '- Server must fail fast with clear error if required env var is missing',
    '- Document all required env vars in README with examples',
    '',
    '## Error Handling',
    '- Wrap every tool handler in try/catch',
    '- Return { error: "Human-readable message" } on failure, not stack traces',
    '- Handle HTTP 401/403 specifically: suggest checking API key',
    '- Handle network errors: suggest checking connectivity',
    '- Handle rate limits (429): include retry-after info if available',
    '',
    '## Publishing Checklist',
    '- package.json: name starts with "mcp-server-", keywords include "mcp-server"',
    '- bin field points to compiled entry',
    '- README includes claude_desktop_config.json example:',
    '  { "mcpServers": { "name": { "command": "npx", "args": ["-y", "mcp-server-xxx"], "env": { "API_KEY": "..." } } } }',
    '- Server starts cleanly with: npx mcp-server-xxx',
    '- All env vars documented with descriptions and defaults',
    '',
    '## Quality Standards',
    '- Generated code must compile with strict TypeScript (no any, no implicit)',
    '- Each tool must handle missing/invalid params gracefully',
    '- Include at least one integration test per tool',
    '- Use zod or JSON Schema validation on tool inputs',
    '',
    '# Behavior Rules',
    '- Act first, explain briefly. Call tools instead of asking questions.',
    '- Keep responses to 1-4 sentences. Expand only when user asks.',
    '- When user says "project dir" / "current folder" / "here" -> use cwd, no questions.',
    '- When user mentions a specific file (e.g., "agent_api.md") -> call read_file with that filename.',
    '- When user says "I put a file" without name -> call read_folder on cwd to discover it, then read_file to read fully.',
    '- If read_folder preview is truncated, ALWAYS follow up with read_file to get the complete content.',
    '- Relative paths resolve from cwd.',
    '- IMPORTANT: Only call fetch_url when user gives an explicit http/https URL.',
    '  Local files/folders -> always read_folder. Never mix fetch_url with local file operations.',
    '- Call ONE tool at a time. Do not call multiple tools in parallel unless clearly needed.',
    '- After reading docs, summarize what tools you would generate BEFORE generating.',
    '',
    '# Workflow',
    '1) Read docs: read_folder (discover files) -> read_file (read full content) or fetch_url (web)',
    '   IMPORTANT: Always read the COMPLETE document before analyzing. Truncated docs lead to missing endpoints.',
    '2) Analyze: identify ALL endpoints, params, auth method, data models',
    '3) Propose: tell user what MCP tools you will generate and why',
    '4) Generate: call generate_mcp to produce the server code',
    '5) Unit test: call run_tests to verify generated code',
    '6) Integration test: ask for real base_url and optional credentials, then call test_integration',
    '7) Publish: ask for market overrides when needed, then call publish_mcp',
    '',
    'Default language: Chinese. Keep technical terms in English (MCP, tool, schema, API, etc.).'
  ].join('\n');
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ChatSessionDeps {
  llm?: ChatCapableLlmProvider;
  fsTool?: Pick<FsTool, 'glob' | 'readFile'>;
  browserTool?: Pick<BrowserTool, 'fetch'>;
  sessionReader?: Pick<SessionReader, 'listSessions' | 'lastRun'>;
  generate?: typeof generateCommand;
  testRunner?: Pick<TestRunner, 'run'>;
  output?: Pick<NodeJS.WriteStream, 'write'>;
  toolHandlers?: Partial<Record<ChatToolName, ToolHandler>>;
}

export class ChatSession {
  private readonly history: ChatMessage[] = [];
  private readonly tools: ReturnType<typeof buildToolDefinitions>;
  private readonly llm: ChatCapableLlmProvider;
  private readonly fsTool: Pick<FsTool, 'glob' | 'readFile'>;
  private readonly browserTool: Pick<BrowserTool, 'fetch'>;
  private readonly sessionReader: Pick<SessionReader, 'listSessions' | 'lastRun'>;
  private readonly generate: typeof generateCommand;
  private readonly testRunner: Pick<TestRunner, 'run'>;
  private readonly output: Pick<NodeJS.WriteStream, 'write'>;
  private readonly toolHandlers: Partial<Record<ChatToolName, ToolHandler>>;

  private lastSource: string | undefined;
  private lastGeneratedDir: string | undefined;

  public constructor(
    private readonly config: ChatConfig,
    deps: ChatSessionDeps = {}
  ) {
    this.tools = buildToolDefinitions(this.config);
    this.llm =
      deps.llm ??
      new OpenRouterProvider(
        'openrouter-chat',
        this.config.model,
        this.config.apiKey,
        this.config.baseUrl
      );
    this.fsTool = deps.fsTool ?? new FsTool();
    this.browserTool = deps.browserTool ?? new BrowserTool();
    this.sessionReader = deps.sessionReader ?? new SessionReader();
    this.generate = deps.generate ?? generateCommand;
    this.testRunner = deps.testRunner ?? new TestRunner();
    this.output = deps.output ?? process.stdout;
    this.toolHandlers = deps.toolHandlers ?? {};
  }

  public async send(userMessage: string): Promise<void> {
    this.history.push({ role: 'user', content: userMessage });

    for (;;) {
      const response = await this.callLlm();

      if (response.finish_reason === 'stop') {
        const assistantText = response.content.trim();
        if (assistantText.length > 0) {
          this.writeLine(assistantText);
        }
        this.history.push({ role: 'assistant', content: response.content });
        return;
      }

      const toolCalls = response.tool_calls ?? [];
      this.history.push({
        role: 'assistant',
        content: response.content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
      });

      for (const toolCall of toolCalls) {
        this.writeLine(`[${toolCall.function.name}] ...`);
        const result = await this.executeTool(toolCall);
        this.history.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id
        });
      }
    }
  }

  private async callLlm() {
    const systemPrompt = await buildSystemPrompt(this.config.workDir);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...this.history];
    return this.llm.chat(messages, this.tools);
  }

  private async executeTool(toolCall: ToolCall): Promise<string> {
    const name = toolCall.function.name as ChatToolName;
    const args = parseToolArguments(toolCall.function.arguments);
    const handler = this.toolHandlers[name];

    if (handler) {
      return handler(args);
    }

    try {
      switch (name) {
        case 'read_folder':
          return this.readFolder(args);
        case 'read_file':
          return this.readSingleFile(args);
        case 'fetch_url':
          return this.fetchUrl(args);
        case 'generate_mcp':
          return this.generateMcp(args);
        case 'run_tests':
          return this.runTests(args);
        case 'test_integration':
          return this.testIntegration(args);
        case 'publish_mcp':
          return this.publishMcp(args);
        case 'show_history':
          return this.showHistory();
        default:
          return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
      }
    } catch (error) {
      return JSON.stringify({ error: formatError(error) });
    }
  }

  private resolvePath(rawPath: string): string {
    return isAbsolute(rawPath) ? rawPath : resolve(this.config.workDir, rawPath);
  }

  private async readFolder(args: Record<string, unknown>): Promise<string> {
    const pathValue =
      typeof args.path === 'string' && args.path.trim() ? args.path.trim() : this.config.workDir;

    const folderPath = this.resolvePath(pathValue);
    if (!existsSync(folderPath)) {
      return JSON.stringify({ error: `Path not found: ${folderPath}` });
    }

    const files = await this.fsTool.glob(folderPath, FOLDER_PATTERNS);
    const textFiles = files.filter(isTextLikeFile).slice(0, MAX_DOC_FILE_COUNT);
    const docs = await Promise.all(
      textFiles.map(async (filePath) => {
        const content = await this.fsTool.readFile(filePath);
        return {
          path: relative(this.config.workDir, filePath) || filePath,
          preview: truncate(content, MAX_SNIPPET_LENGTH)
        };
      })
    );

    this.lastSource = pathValue;
    return JSON.stringify(
      {
        path: folderPath,
        fileCount: files.length,
        files: files.map((filePath) => relative(this.config.workDir, filePath) || filePath),
        docs
      },
      null,
      2
    );
  }

  private async readSingleFile(args: Record<string, unknown>): Promise<string> {
    const pathValue = typeof args.path === 'string' ? args.path.trim() : '';
    if (!pathValue) {
      return JSON.stringify({ error: 'Missing required argument: path' });
    }

    const filePath = this.resolvePath(pathValue);
    if (!existsSync(filePath)) {
      return JSON.stringify({ error: `File not found: ${filePath}` });
    }

    const content = await this.fsTool.readFile(filePath);
    this.lastSource = pathValue;

    return JSON.stringify(
      {
        path: filePath,
        length: content.length,
        content: truncate(content, MAX_FILE_READ_LENGTH)
      },
      null,
      2
    );
  }

  private async fetchUrl(args: Record<string, unknown>): Promise<string> {
    const url = typeof args.url === 'string' ? args.url : '';
    if (!url) {
      return JSON.stringify({ error: 'Missing required argument: url' });
    }

    const page = await this.browserTool.fetch(url);
    this.lastSource = url;

    return JSON.stringify(
      {
        url: page.url,
        title: page.title,
        links: page.links.slice(0, 100),
        openApiUrls: page.openApiUrls,
        text: truncate(page.text, 8000)
      },
      null,
      2
    );
  }

  private async generateMcp(args: Record<string, unknown>): Promise<string> {
    const source =
      typeof args.source === 'string' && args.source.trim() ? args.source : this.lastSource;
    const outputDir =
      typeof args.output_dir === 'string' && args.output_dir.trim() ? args.output_dir : undefined;

    if (!source) {
      return JSON.stringify({ error: 'Missing required argument: source' });
    }

    const logs: string[] = [];
    const resolvedOutput =
      outputDir ?? (isUrl(source) ? resolve(this.config.workDir, 'generated-mcp') : undefined);

    await this.generate({
      source,
      output: resolvedOutput,
      logger: { log: (line: string) => logs.push(line) }
    });

    this.lastSource = source;
    this.lastGeneratedDir =
      resolvedOutput ??
      (isUrl(source) ? resolve(this.config.workDir, 'generated-mcp') : this.resolvePath(source));

    return JSON.stringify(
      {
        status: 'ok',
        source,
        outputDir: this.lastGeneratedDir,
        logs
      },
      null,
      2
    );
  }

  private async runTests(args: Record<string, unknown>): Promise<string> {
    const dirValue =
      typeof args.dir === 'string' && args.dir.trim() ? args.dir : this.lastGeneratedDir;
    if (!dirValue) {
      return JSON.stringify({ error: 'Missing required argument: dir' });
    }

    const targetDir = this.resolvePath(dirValue);
    const output = await this.testRunner.run(targetDir);
    const mergedOutput = [output.stdout, output.stderr].filter(Boolean).join('\n');

    return JSON.stringify(
      {
        dir: targetDir,
        output: truncate(mergedOutput, MAX_TEST_OUTPUT)
      },
      null,
      2
    );
  }

  private async testIntegration(args: Record<string, unknown>): Promise<string> {
    const dirValue =
      typeof args.dir === 'string' && args.dir.trim()
        ? args.dir.trim()
        : (this.lastGeneratedDir ?? this.config.workDir);
    const baseUrl = typeof args.base_url === 'string' ? args.base_url.trim() : '';

    if (!baseUrl) {
      return JSON.stringify({ error: 'base_url is required' });
    }

    const authEnv: Record<string, string> = {};
    if (args.auth_env && typeof args.auth_env === 'object' && !Array.isArray(args.auth_env)) {
      for (const [key, value] of Object.entries(args.auth_env as Record<string, unknown>)) {
        if (typeof value === 'string') {
          authEnv[key] = value;
        }
      }
    }

    const tester = new IntegrationTester();
    const report = await tester.run({
      dir: this.resolvePath(dirValue),
      baseUrl,
      authEnv
    });

    return JSON.stringify(report, null, 2);
  }

  private async publishMcp(args: Record<string, unknown>): Promise<string> {
    const dirValue =
      typeof args.dir === 'string' && args.dir.trim()
        ? args.dir.trim()
        : (this.lastGeneratedDir ?? this.config.workDir);
    const marketUrl = typeof args.market_url === 'string' ? args.market_url.trim() : '';
    const token = typeof args.token === 'string' ? args.token.trim() : '';
    const existingToken = getToken();

    if (token) {
      saveToken(token, marketUrl || getMarketUrl());
    } else if (marketUrl && existingToken) {
      saveToken(existingToken, marketUrl);
    }

    try {
      await publishCommand({}, this.resolvePath(dirValue));
      return JSON.stringify({ status: 'ok', dir: this.resolvePath(dirValue) });
    } catch (error) {
      return JSON.stringify({ error: formatError(error) });
    }
  }

  private async showHistory(): Promise<string> {
    const sessions = this.sessionReader.listSessions(10).map((session) => ({
      file: session.file,
      time: session.mtime.toISOString(),
      title: session.preview.replace(/^#\s*/, '').trim()
    }));
    const lastRun = this.sessionReader.lastRun(this.config.workDir);

    return JSON.stringify(
      {
        recentSessions: sessions,
        lastRun: lastRun
          ? {
              source: lastRun.source,
              status: lastRun.status,
              finishedAt: lastRun.finishedAt,
              toolCount: lastRun.ir?.toolCount ?? 0
            }
          : null
      },
      null,
      2
    );
  }

  private writeLine(text: string): void {
    this.output.write(`${text}\n`);
  }
}
