import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import { TestRunner } from '../agents/tester/test-runner';
import { generateCommand, isUrl } from '../commands/generate.command';
import type { ChatCapableLlmProvider, ChatMessage, ToolCall } from '../llm/llm-client';
import { OpenRouterProvider } from '../llm/llm-client';
import { SessionReader } from '../memory/session-reader';
import { BrowserTool } from '../tools/browser-tool';
import { FsTool } from '../tools/fs-tool';
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

const MAX_DOC_FILE_COUNT = 20;
const MAX_SNIPPET_LENGTH = 3000;
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
  const [projectName, gitContext] = await Promise.all([readProjectName(workDir), readGitContext(workDir)]);
  const now = new Date().toISOString();
  const branch = gitContext.isRepo
    ? gitContext.branch ?? '(detached HEAD)'
    : '(not a git repository)';
  const latestCommit = gitContext.isRepo
    ? gitContext.latestCommit ?? '(unavailable)'
    : '(not a git repository)';

  return [
    'Environment Context:',
    `- Working directory (cwd): ${workDir}`,
    `- Platform: ${process.platform}`,
    `- Current time: ${now}`,
    `- Project name: ${projectName ?? '(unknown)'}`,
    `- Git branch: ${branch}`,
    `- Latest commit: ${latestCommit}`,
    '',
    '你是 mcp-claw，一个 AI-powered MCP server generator。',
    '行为原则（参考 OpenCode / Gemini CLI）：',
    '- 先行动，后解释：能调用工具就先调用，不要先写长段推理。',
    '- 保持简洁：默认 1-4 句；只在用户要求时展开细节。',
    '- 基于证据：不要猜测文件或 API 细节，先用工具拿到事实。',
    '',
    '工具调用规则：',
    '- 用户提到“项目目录/根目录/当前目录/这个文件夹/放在这里”时，优先调用 read_folder；path 省略时默认 cwd。',
    '- 用户没给路径但说“我放了文档/文件”，先调用 read_folder，不要先追问。',
    '- 用户给出 URL 或在线文档时，调用 fetch_url。',
    '- 信息足够且用户同意生成时，调用 generate_mcp。',
    '- 生成完成后，用户要求验证或你需要确认可运行性时，调用 run_tests。',
    '- 用户询问历史记录或上次结果时，调用 show_history。',
    '',
    '工作流程：',
    '1) 读取并理解 API 文档',
    '2) 设计 MCP tools',
    '3) 生成可运行的 MCP server 代码',
    '4) 测试并给出下一步建议',
    '',
    '默认用中文回复（除非用户使用其他语言）。英文技术术语保留英文。'
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
      new OpenRouterProvider('openrouter-chat', this.config.model, this.config.apiKey, this.config.baseUrl);
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

    while (true) {
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
        case 'fetch_url':
          return this.fetchUrl(args);
        case 'generate_mcp':
          return this.generateMcp(args);
        case 'run_tests':
          return this.runTests(args);
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
    const pathValue = typeof args.path === 'string' && args.path.trim()
      ? args.path.trim()
      : this.config.workDir;

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
    const source = typeof args.source === 'string' && args.source.trim() ? args.source : this.lastSource;
    const outputDir = typeof args.output_dir === 'string' && args.output_dir.trim() ? args.output_dir : undefined;

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
    const dirValue = typeof args.dir === 'string' && args.dir.trim() ? args.dir : this.lastGeneratedDir;
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
