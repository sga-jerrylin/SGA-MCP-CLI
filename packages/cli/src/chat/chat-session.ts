import { exec } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';

import { IntegrationTester } from '../agents/tester/integration-tester';
import { TestRunner } from '../agents/tester/test-runner';
import { generateCommand, isUrl } from '../commands/generate.command';
import { publishCommand } from '../commands/publish.command';
import { SgaConfig } from '../config/sga-config';
import type { ChatCapableLlmProvider, ChatMessage, ToolCall } from '../llm/llm-client';
import { OpenRouterProvider } from '../llm/llm-client';
import { SessionReader } from '../memory/session-reader';
import { BrowserTool } from '../tools/browser-tool';
import { FsTool } from '../tools/fs-tool';
import { HttpFetchTool } from '../tools/http-tool';
import { PdfTool } from '../tools/pdf-tool';
import { getMarketUrl, getToken, saveToken } from '../utils/auth';
import type { ChatConfig } from './chat-types';
import { buildToolDefinitions, type ChatToolName } from './tool-definitions';

const execAsync = promisify(exec);

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
const MAX_PDF_CONTENT = 100_000;
const MAX_HTTP_BODY = 20_000;
const MAX_SEARCH_MATCHES = 50;
const MAX_CRAWL_COMBINED_TEXT = 150_000;
const DEFAULT_DOC_CRAWL_PAGES = 10;
const MAX_DOC_CRAWL_PAGES = 30;
const DEFAULT_SGA_SEARCH_LIMIT = 5;
const MAX_SGA_SEARCH_LIMIT = 50;
const DEFAULT_OPENAPI_MAX_ENDPOINTS = 100;
const SUPPORTED_HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace'
]);

interface SgaSearchRow {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
  domain?: string;
}

interface OpenApiEndpointSummary {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
  }>;
  requestBody?: {
    contentType: string;
    schema: string;
  };
  responses: Record<string, string>;
}

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

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function deriveSgaSearchEndpoint(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  return `${parsed.protocol}//${parsed.host}/v1/agent/search`;
}

function parseSearchPayload(
  payload: unknown,
  limit: number
): {
  total: number;
  results: SgaSearchRow[];
  suggestions: string[];
} {
  const record = asRecord(payload);
  const sourceResults = Array.isArray(record.results) ? record.results : [];
  const rows: SgaSearchRow[] = [];

  for (const item of sourceResults) {
    const row = asRecord(item);
    const title = toStringValue(row.title);
    const url = toStringValue(row.url);
    if (!url) {
      continue;
    }
    const content = toStringValue(row.content);
    const snippet =
      content.length > 0 ? content.slice(0, 300) : toStringValue(row.snippet).slice(0, 300);
    const publishedDate = toStringValue(row.published_date);
    const domain = toStringValue(row.domain);

    rows.push({
      title,
      url,
      snippet,
      ...(publishedDate ? { published_date: publishedDate } : {}),
      ...(domain ? { domain } : {})
    });
  }

  return {
    total: toNumber(record.total_results, rows.length),
    results: rows.slice(0, limit),
    suggestions: toStringArray(record.suggestions)
  };
}

function parseYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMinimalOpenApiYaml(content: string): Record<string, unknown> {
  const lines = content.split(/\r?\n/);
  const doc: Record<string, unknown> = {
    info: {},
    servers: [],
    paths: {},
    components: {
      securitySchemes: {},
      schemas: {}
    }
  };

  let section = '';
  let inSecuritySchemes = false;
  let inSchemas = false;
  let currentPath = '';
  let currentMethod = '';
  let currentServerIndex = -1;

  for (const rawLine of lines) {
    const commentFree = rawLine.replace(/\s+#.*$/, '');
    if (!commentFree.trim()) {
      continue;
    }
    const indent = commentFree.match(/^ */)?.[0].length ?? 0;
    const trimmed = commentFree.trim();

    if (indent === 0) {
      if (trimmed.startsWith('openapi:')) {
        doc.openapi = parseYamlScalar(trimmed.slice('openapi:'.length));
      } else if (trimmed.startsWith('swagger:')) {
        doc.swagger = parseYamlScalar(trimmed.slice('swagger:'.length));
      } else if (trimmed === 'info:') {
        section = 'info';
      } else if (trimmed === 'servers:') {
        section = 'servers';
      } else if (trimmed === 'paths:') {
        section = 'paths';
      } else if (trimmed === 'components:') {
        section = 'components';
      } else {
        section = '';
      }
      inSecuritySchemes = false;
      inSchemas = false;
      currentPath = '';
      currentMethod = '';
      currentServerIndex = -1;
      continue;
    }

    if (section === 'info' && indent === 2) {
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (match) {
        const info = asRecord(doc.info);
        info[match[1]] = parseYamlScalar(match[2]);
        doc.info = info;
      }
      continue;
    }

    if (section === 'servers') {
      if (indent === 2 && trimmed.startsWith('-')) {
        const rest = trimmed.slice(1).trim();
        const server: Record<string, unknown> = {};
        const inline = rest.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (inline) {
          server[inline[1]] = parseYamlScalar(inline[2]);
        }
        const servers = (Array.isArray(doc.servers) ? doc.servers : []) as Array<
          Record<string, unknown>
        >;
        servers.push(server);
        doc.servers = servers;
        currentServerIndex = servers.length - 1;
      } else if (indent === 4 && currentServerIndex >= 0) {
        const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) {
          const servers = (Array.isArray(doc.servers) ? doc.servers : []) as Array<
            Record<string, unknown>
          >;
          const current = asRecord(servers[currentServerIndex]);
          current[kv[1]] = parseYamlScalar(kv[2]);
          servers[currentServerIndex] = current;
          doc.servers = servers;
        }
      }
      continue;
    }

    if (section === 'components') {
      if (indent === 2 && trimmed === 'securitySchemes:') {
        inSecuritySchemes = true;
        inSchemas = false;
        continue;
      }
      if (indent === 2 && trimmed === 'schemas:') {
        inSchemas = true;
        inSecuritySchemes = false;
        continue;
      }

      if (indent === 4 && inSecuritySchemes && trimmed.endsWith(':')) {
        const key = trimmed.slice(0, -1).trim();
        const components = asRecord(doc.components);
        const securitySchemes = asRecord(components.securitySchemes);
        securitySchemes[key] = {};
        components.securitySchemes = securitySchemes;
        doc.components = components;
        continue;
      }

      if (indent === 6 && inSecuritySchemes) {
        const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) {
          const components = asRecord(doc.components);
          const securitySchemes = asRecord(components.securitySchemes);
          const entries = Object.entries(securitySchemes);
          if (entries.length > 0) {
            const [name] = entries[entries.length - 1];
            const scheme = asRecord(securitySchemes[name]);
            scheme[kv[1]] = parseYamlScalar(kv[2]);
            securitySchemes[name] = scheme;
            components.securitySchemes = securitySchemes;
            doc.components = components;
          }
        }
        continue;
      }

      if (indent === 4 && inSchemas && trimmed.endsWith(':')) {
        const key = trimmed.slice(0, -1).trim();
        const components = asRecord(doc.components);
        const schemas = asRecord(components.schemas);
        schemas[key] = {};
        components.schemas = schemas;
        doc.components = components;
        continue;
      }

      continue;
    }

    if (section === 'paths') {
      if (indent === 2 && trimmed.endsWith(':')) {
        currentPath = trimmed.slice(0, -1).trim();
        const paths = asRecord(doc.paths);
        paths[currentPath] = {};
        doc.paths = paths;
        currentMethod = '';
        continue;
      }

      if (indent === 4 && trimmed.endsWith(':') && currentPath) {
        const methodName = trimmed.slice(0, -1).trim().toLowerCase();
        if (SUPPORTED_HTTP_METHODS.has(methodName)) {
          currentMethod = methodName;
          const paths = asRecord(doc.paths);
          const pathItem = asRecord(paths[currentPath]);
          pathItem[currentMethod] = {};
          paths[currentPath] = pathItem;
          doc.paths = paths;
        }
        continue;
      }

      if (indent === 6 && currentPath && currentMethod) {
        const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) {
          const paths = asRecord(doc.paths);
          const pathItem = asRecord(paths[currentPath]);
          const operation = asRecord(pathItem[currentMethod]);
          operation[kv[1]] = parseYamlScalar(kv[2]);
          pathItem[currentMethod] = operation;
          paths[currentPath] = pathItem;
          doc.paths = paths;
        }
      }
    }
  }

  return doc;
}

function summarizeSchema(schema: unknown): string {
  const record = asRecord(schema);
  const type = toStringValue(record.type);
  const ref = toStringValue(record.$ref);
  if (ref) {
    return ref;
  }
  if (type) {
    return type;
  }
  return 'object';
}

function extractAuthSchemes(document: Record<string, unknown>): string[] {
  const components = asRecord(document.components);
  const securitySchemes = asRecord(components.securitySchemes);
  const auth = new Set<string>();

  for (const schemeValue of Object.values(securitySchemes)) {
    const scheme = asRecord(schemeValue);
    const type = toStringValue(scheme.type).toLowerCase();
    if (type === 'apikey') {
      auth.add('apiKey');
    } else if (type === 'oauth2') {
      auth.add('oauth2');
    } else if (type === 'http') {
      const httpScheme = toStringValue(scheme.scheme).toLowerCase();
      if (httpScheme === 'bearer') {
        auth.add('bearer');
      } else if (httpScheme === 'basic') {
        auth.add('basic');
      }
    }
  }

  return [...auth];
}

function extractOpenApiEndpoints(
  document: Record<string, unknown>,
  maxEndpoints: number
): { endpointCount: number; endpoints: OpenApiEndpointSummary[] } {
  const paths = asRecord(document.paths);
  const endpoints: OpenApiEndpointSummary[] = [];
  let total = 0;

  for (const [pathKey, pathValue] of Object.entries(paths)) {
    const pathItem = asRecord(pathValue);
    const pathLevelParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const [methodKey, operationValue] of Object.entries(pathItem)) {
      const method = methodKey.toLowerCase();
      if (!SUPPORTED_HTTP_METHODS.has(method)) {
        continue;
      }

      total += 1;
      if (endpoints.length >= maxEndpoints) {
        continue;
      }

      const operation = asRecord(operationValue);
      const operationParameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const mergedParameters = [...pathLevelParameters, ...operationParameters];
      const parameters = mergedParameters
        .map((item) => asRecord(item))
        .map((param) => {
          const schema = asRecord(param.schema);
          return {
            name: toStringValue(param.name),
            in: toStringValue(param.in),
            required: Boolean(param.required),
            type: toStringValue(schema.type) || summarizeSchema(schema)
          };
        })
        .filter((param) => param.name.length > 0);

      let requestBody: OpenApiEndpointSummary['requestBody'];
      const bodyRecord = asRecord(operation.requestBody);
      const contentRecord = asRecord(bodyRecord.content);
      const contentTypes = Object.keys(contentRecord);
      if (contentTypes.length > 0) {
        const contentType = contentTypes[0];
        const contentSpec = asRecord(contentRecord[contentType]);
        requestBody = {
          contentType,
          schema: summarizeSchema(contentSpec.schema)
        };
      }

      const responsesRecord = asRecord(operation.responses);
      const responseSummaries: Record<string, string> = {};
      for (const [statusCode, responseValue] of Object.entries(responsesRecord)) {
        const response = asRecord(responseValue);
        responseSummaries[statusCode] = toStringValue(response.description);
      }

      endpoints.push({
        method: method.toUpperCase(),
        path: pathKey,
        operationId: toStringValue(operation.operationId),
        summary: toStringValue(operation.summary),
        description: toStringValue(operation.description),
        parameters,
        ...(requestBody ? { requestBody } : {}),
        responses: responseSummaries
      });
    }
  }

  return {
    endpointCount: total,
    endpoints
  };
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
    const { stdout } = await execAsync(`git ${args.join(' ')}`, {
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

async function buildSystemPrompt(workDir: string, restoredMessages = 0): Promise<string> {
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
    ...(restoredMessages > 0
      ? [
          `chat_history: ${restoredMessages} messages restored from previous session 鈥?you HAVE full context`,
          ''
        ]
      : []),
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
    '# Available Tools Summary',
    'You now have 15 tools. Use them in combination:',
    '',
    'Discovery flow:',
    '  "make MCP for Stripe" -> sga_search("Stripe API documentation") -> discover best docs URL -> fetch_url or crawl_docs -> generate_mcp',
    '',
    'OpenAPI fast path:',
    '  User provides URL -> http_request(url + /openapi.json) to probe -> if found, parse_openapi -> generate_mcp',
    '',
    'Editing flow:',
    '  After generate_mcp -> search_files("error") -> write_file to fix -> run_command("npx tsc --noEmit")',
    '',
    'PDF docs:',
    '  User drops a PDF -> read_pdf -> generate_mcp',
    '',
    'The sga_search tool searches the web with Chinese/WeChat support. prefer it over fetch_url for discovery.',
    'Configure with: mcp-claw config set search.url http://<host>/v1/agent/search',
    '',
    '# Shell Access (run_command)',
    'You have full shell access via run_command. Critical rules for Windows compatibility:',
    '',
    '## NEVER do this (causes "Command failed" with no useful error):',
    '  WRONG: run_command("cd generated && npx tsc --noEmit")',
    '  WRONG: run_command("cd generated && npx jest 2>&1")',
    '  WRONG: run_command("node_modules/.bin/tsc --noEmit")',
    '  WRONG: run_command("node_modules\\.bin\\tsc")',
    '',
    '## ALWAYS do this instead (use the cwd parameter):',
    '  RIGHT: run_command("npx tsc --noEmit", cwd: "generated")',
    '  RIGHT: run_command("npx jest --no-coverage", cwd: "generated")',
    '  RIGHT: run_command("pnpm install", cwd: "generated")',
    '  RIGHT: run_command("dir src", cwd: "generated")   // Windows: use dir not ls',
    '',
    '## Key rules:',
    '- NEVER use `cd path && command` 鈥?use cwd parameter instead',
    '- NEVER use `2>&1` 鈥?stderr is captured automatically on errors',
    '- NEVER use `node_modules/.bin/` or `node_modules\\.bin\\` 鈥?use `npx <tool>` instead',
    '- On Windows use `dir` not `ls`, use `type` not `cat`',
    '- The cwd defaults to the last generated project dir automatically',
    '- To compile: run_command("npx tsc --noEmit") 鈥?no cd needed if cwd is already right',
    '- To install deps: run_command("pnpm install") in project cwd',
    '',
    '## When run_command returns status: error 鈥?MANDATORY debug protocol:',
    '1. STOP. Do NOT immediately retry the same command.',
    '2. READ the full "output" field 鈥?it contains the actual error messages.',
    '   TypeScript errors: "src/file.ts(10,5): error TS2345: Argument of type..."',
    '   Missing module: "Cannot find module \'zod\' or its type declarations"',
    '3. Identify WHICH file and line number has the error.',
    '4. read_file the problematic file to understand the code.',
    '5. write_file to fix the error.',
    '6. run_command("npx tsc --noEmit") again to verify the fix.',
    '',
    '## Special case: Empty output from run_command (V8 crash)',
    'If run_command returns status: error with empty or missing output for a TypeScript command:',
    '  CAUSE: JavaScript heap out of memory - TypeScript type checker crashed.',
    '  ALWAYS check server.ts for: zodToJsonSchema(schema) as Tool["inputSchema"]',
    '  FIX: Replace with toInputSchema helper (see below) or use (zodToJsonSchema as (s: unknown) => Tool["inputSchema"])(schema)',
    '  DO NOT retry the same tsc command - it will always crash until the code is fixed.',
    '',
    '## NEVER do these when you see an error:',
    '- NEVER add 2>&1 to capture stderr (stderr is already in "output")',
    '- NEVER add || true to suppress exit codes (hides real errors)',
    '- NEVER retry the exact same command without first fixing root cause',
    'When something fails, DO NOT give up. Analyze 鈫?Fix 鈫?Verify.',
    '',
    '# Workflow',
    '1) Read docs: read_folder (discover files) -> read_file (read full content) or fetch_url (web)',
    '   IMPORTANT: Always read the COMPLETE document before analyzing. Truncated docs lead to missing endpoints.',
    '2) Analyze: identify ALL endpoints, params, auth method, data models',
    '3) Propose: tell user what MCP tools you will generate and why. Wait for user confirmation.',
    '4) Generate: call generate_mcp to produce the server code',
    '5) Validate: use run_command to compile and verify the generated project:',
    '   - run_command("npx tsc --noEmit") to check TypeScript compilation',
    '   - If errors, fix them with run_command (install deps, etc.)',
    '   - run_command("npx jest") if tests exist',
    '6) **STOP here.** Report what was generated (tool count, files, output dir).',
    '   Then ask the user:',
    '   - "瑕佽繘琛岄泦鎴愭祴璇曞悧锛熻鎻愪緵锛?) API base URL  2) 闇€瑕佺殑 credentials (濡?API key)"',
    '   - Do NOT call test_integration until the user provides the URL and credentials.',
    '   - If user says skip, go directly to step 8.',
    '7) Integration test: call test_integration with the user-provided base_url and auth_env.',
    '8) **STOP again.** Show test results. Ask: "瑕佸彂甯冨埌 MCP Market 鍚楋紵"',
    '   - Do NOT call publish_mcp until user confirms.',
    '',
    '# CRITICAL: Never auto-proceed past step 6. Always pause for user input before integration testing and publishing.',
    '',
    '# Self-Evolution Protocol',
    'When you complete an error鈫抐ix鈫抳erify cycle (run_command failed 鈫?you fixed it 鈫?run_command passed):',
    '  ALWAYS call record_learning immediately after the fix is confirmed.',
    '  This saves the pattern to .mcp-claw/patterns.md and helps future sessions avoid the same mistake.',
    '  Good triggers: missing dependency, TypeScript type error, wrong import path, config issue.',
    '',
    '# Chat History vs Run History 鈥?IMPORTANT DISTINCTION',
    'Your conversation messages are ALWAYS loaded at startup from .mcp-claw/chat-history.json.',
    'If you can see prior "user" and "assistant" messages in your context, that IS the real history.',
    'NEVER say "I have no context" or "I cannot find previous conversation" when history is present.',
    'NEVER use show_history to look for chat content 鈥?it only returns MCP generation run logs, NOT chat.',
    'show_history is for: "what MCPs have I generated before?" NOT for: "what did we discuss?"',
    '',
    'Default language: Chinese. Keep technical terms in English (MCP, tool, schema, API, etc.).',
    ...loadLearnedPatterns(workDir)
  ].join('\n');
}

function loadLearnedPatterns(workDir: string): string[] {
  const patternsFile = join(workDir, '.mcp-claw', 'patterns.md');
  if (!existsSync(patternsFile)) return [];
  try {
    const content = readFileSync(patternsFile, 'utf8').trim();
    if (content.length < 10) return [];
    return ['', '# Learned Patterns (from this project 鈥?apply these automatically)', content];
  } catch {
    return [];
  }
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ChatSessionDeps {
  llm?: ChatCapableLlmProvider;
  fsTool?: Pick<FsTool, 'glob' | 'readFile' | 'writeFile'>;
  browserTool?: Pick<BrowserTool, 'fetch'>;
  httpTool?: Pick<HttpFetchTool, 'request'>;
  pdfTool?: Pick<PdfTool, 'extract'>;
  sessionReader?: Pick<SessionReader, 'listSessions' | 'lastRun'>;
  generate?: typeof generateCommand;
  testRunner?: Pick<TestRunner, 'run'>;
  output?: Pick<NodeJS.WriteStream, 'write'>;
  toolHandlers?: Partial<Record<ChatToolName, ToolHandler>>;
}

function historyPath(workDir: string): string {
  return join(workDir, '.mcp-claw', 'chat-history.json');
}

interface PersistedState {
  history: ChatMessage[];
  lastSource?: string;
  lastGeneratedDir?: string;
}

function loadPersistedState(workDir: string): PersistedState | null {
  const filePath = historyPath(workDir);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersistedState(workDir: string, state: PersistedState): void {
  const filePath = historyPath(workDir);
  const dir = join(workDir, '.mcp-claw');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Keep only the last 40 messages to avoid unbounded growth
  const trimmed = {
    ...state,
    history: state.history.slice(-40)
  };
  writeFileSync(filePath, JSON.stringify(trimmed, null, 2), 'utf8');
}

export class ChatSession {
  private readonly history: ChatMessage[] = [];
  private readonly tools: ReturnType<typeof buildToolDefinitions>;
  private llm: ChatCapableLlmProvider;
  private readonly fsTool: Pick<FsTool, 'glob' | 'readFile' | 'writeFile'>;
  private readonly browserTool: Pick<BrowserTool, 'fetch'>;
  private readonly httpTool: Pick<HttpFetchTool, 'request'>;
  private readonly pdfTool: Pick<PdfTool, 'extract'>;
  private readonly sessionReader: Pick<SessionReader, 'listSessions' | 'lastRun'>;
  private readonly generate: typeof generateCommand;
  private readonly testRunner: Pick<TestRunner, 'run'>;
  private readonly output: Pick<NodeJS.WriteStream, 'write'>;
  private readonly toolHandlers: Partial<Record<ChatToolName, ToolHandler>>;
  private readonly sgaConfig: SgaConfig;

  private lastSource: string | undefined;
  private lastGeneratedDir: string | undefined;
  private cachedSystemPrompt: string | undefined;

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
    this.httpTool = deps.httpTool ?? new HttpFetchTool();
    this.pdfTool = deps.pdfTool ?? new PdfTool();
    this.sessionReader = deps.sessionReader ?? new SessionReader();
    this.generate = deps.generate ?? generateCommand;
    this.testRunner = deps.testRunner ?? new TestRunner();
    this.output = deps.output ?? process.stdout;
    this.toolHandlers = deps.toolHandlers ?? {};
    this.sgaConfig = new SgaConfig();

    // Restore previous session state
    const persisted = loadPersistedState(this.config.workDir);
    if (persisted) {
      this.history.push(...persisted.history);
      this.lastSource = persisted.lastSource;
      this.lastGeneratedDir = persisted.lastGeneratedDir;
    }
  }

  /** Number of restored messages from previous session */
  public get restoredCount(): number {
    return this.history.length;
  }

  public async send(userMessage: string): Promise<void> {
    // Build system prompt once per user message (not per LLM call in tool loop)
    this.cachedSystemPrompt = await buildSystemPrompt(this.config.workDir, this.history.length);
    const historySnapshot = this.history.length;
    this.history.push({ role: 'user', content: userMessage });

    try {
      for (;;) {
        const response = await this.callLlm();

        if (response.finish_reason === 'stop') {
          const assistantText = response.content.trim();
          if (assistantText.length > 0) {
            this.writeAssistant(assistantText);
          }
          this.history.push({ role: 'assistant', content: response.content });
          this.persistState();
          return;
        }

        // Show inline text from assistant before tool calls
        const inlineText = response.content.trim();
        if (inlineText.length > 0) {
          this.writeAssistant(inlineText);
        }

        const toolCalls = response.tool_calls ?? [];
        this.history.push({
          role: 'assistant',
          content: response.content,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        });

        for (const toolCall of toolCalls) {
          const toolArgs = parseToolArguments(toolCall.function.arguments);
          this.writeToolStart(toolCall.function.name, toolArgs);
          const result = await this.executeTool(toolCall);
          this.writeToolDone(toolCall.function.name, result);
          this.history.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id
          });
        }
      }
    } catch (error) {
      // Roll back history to before this user message so next send() starts clean
      this.history.length = historySnapshot;
      throw error;
    }
  }

  private async callLlm() {
    const systemPrompt =
      this.cachedSystemPrompt ??
      (await buildSystemPrompt(this.config.workDir, this.history.length));
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
        case 'write_file':
          return this.writeFile(args);
        case 'search_files':
          return this.searchFiles(args);
        case 'read_pdf':
          return this.readPdf(args);
        case 'http_request':
          return this.httpRequest(args);
        case 'crawl_docs':
          return this.crawlDocs(args);
        case 'discover_docs':
          return this.discoverDocs(args);
        case 'sga_search':
          return this.sgaSearch(args);
        case 'parse_openapi':
          return this.parseOpenApi(args);
        case 'run_command':
          return this.runShellCommand(args);
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
        case 'record_learning':
          return this.recordLearning(args);
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

  private async writeFile(args: Record<string, unknown>): Promise<string> {
    const pathValue = typeof args.path === 'string' ? args.path.trim() : '';
    if (!pathValue) {
      return JSON.stringify({ error: 'Missing required argument: path' });
    }

    if (typeof args.content !== 'string') {
      return JSON.stringify({ error: 'Missing required argument: content' });
    }

    const resolvedPath = this.resolvePath(pathValue);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    await this.fsTool.writeFile(resolvedPath, args.content);

    return JSON.stringify(
      {
        status: 'ok',
        path: resolvedPath,
        bytes: args.content.length
      },
      null,
      2
    );
  }

  private async searchFiles(args: Record<string, unknown>): Promise<string> {
    const pattern = typeof args.pattern === 'string' ? args.pattern.trim() : '';
    if (!pattern) {
      return JSON.stringify({ error: 'Missing required argument: pattern' });
    }

    const pathValue =
      typeof args.path === 'string' && args.path.trim()
        ? args.path.trim()
        : (this.lastGeneratedDir ?? this.config.workDir);
    const rootPath = this.resolvePath(pathValue);
    const globPattern = typeof args.glob === 'string' && args.glob.trim() ? args.glob.trim() : '*';

    let matcher: RegExp;
    try {
      matcher = new RegExp(pattern, 'i');
    } catch (error) {
      return JSON.stringify({ error: `Invalid pattern: ${formatError(error)}` });
    }

    const files = await this.fsTool.glob(rootPath, [globPattern]);
    const matches: Array<{ file: string; line: number; text: string }> = [];
    let totalMatches = 0;

    for (const filePath of files) {
      let content: string;
      try {
        content = await this.fsTool.readFile(filePath);
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const lineText = lines[index];
        if (!matcher.test(lineText)) {
          continue;
        }

        totalMatches += 1;
        if (matches.length < MAX_SEARCH_MATCHES) {
          matches.push({
            file: relative(this.config.workDir, filePath) || filePath,
            line: index + 1,
            text: lineText
          });
        }
      }
    }

    return JSON.stringify(
      {
        matches,
        totalMatches
      },
      null,
      2
    );
  }

  private async readPdf(args: Record<string, unknown>): Promise<string> {
    const pathValue = typeof args.path === 'string' ? args.path.trim() : '';
    if (!pathValue) {
      return JSON.stringify({ error: 'Missing required argument: path' });
    }

    const resolvedPath = this.resolvePath(pathValue);
    if (!existsSync(resolvedPath)) {
      return JSON.stringify({ error: `File not found: ${resolvedPath}` });
    }

    const text = await this.pdfTool.extract(resolvedPath);

    return JSON.stringify(
      {
        path: resolvedPath,
        length: text.length,
        content: truncate(text, MAX_PDF_CONTENT)
      },
      null,
      2
    );
  }

  private async httpRequest(args: Record<string, unknown>): Promise<string> {
    const url = typeof args.url === 'string' ? args.url.trim() : '';
    if (!url) {
      return JSON.stringify({ error: 'Missing required argument: url' });
    }

    const method =
      typeof args.method === 'string' && args.method.trim()
        ? args.method.trim().toUpperCase()
        : 'GET';
    const timeoutMs =
      typeof args.timeout_ms === 'number' && Number.isFinite(args.timeout_ms)
        ? Math.max(1, Math.floor(args.timeout_ms))
        : 10_000;

    const headers: Record<string, string> = {};
    if (args.headers && typeof args.headers === 'object' && !Array.isArray(args.headers)) {
      for (const [key, value] of Object.entries(args.headers as Record<string, unknown>)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
    }

    const body = typeof args.body === 'string' ? args.body : undefined;

    try {
      const response = await this.httpTool.request({
        url,
        method,
        headers,
        body,
        timeoutMs
      });

      return JSON.stringify(
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: truncate(response.body, MAX_HTTP_BODY),
          url: response.url
        },
        null,
        2
      );
    } catch (error) {
      return JSON.stringify({ error: formatError(error), url }, null, 2);
    }
  }

  private async crawlDocs(args: Record<string, unknown>): Promise<string> {
    const startUrl = typeof args.start_url === 'string' ? args.start_url.trim() : '';
    if (!startUrl) {
      return JSON.stringify({ error: 'Missing required argument: start_url' });
    }

    let start: URL;
    try {
      start = new URL(startUrl);
    } catch {
      return JSON.stringify({ error: `Invalid URL: ${startUrl}` });
    }

    const rawMaxPages =
      typeof args.max_pages === 'number' && Number.isFinite(args.max_pages)
        ? Math.floor(args.max_pages)
        : DEFAULT_DOC_CRAWL_PAGES;
    const maxPages = Math.min(MAX_DOC_CRAWL_PAGES, Math.max(1, rawMaxPages));

    let linkPattern: RegExp | undefined;
    if (typeof args.link_pattern === 'string' && args.link_pattern.trim()) {
      try {
        linkPattern = new RegExp(args.link_pattern, 'i');
      } catch (error) {
        return JSON.stringify({ error: `Invalid link_pattern: ${formatError(error)}` });
      }
    }

    const queue: string[] = [start.href];
    const visited = new Set<string>();
    const discovered = new Set<string>([start.href]);
    const pages: Array<{ url: string; title: string; textLength: number }> = [];
    const combinedParts: string[] = [];

    while (queue.length > 0 && visited.size < maxPages) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);

      let page: Awaited<ReturnType<BrowserTool['fetch']>>;
      try {
        page = await this.browserTool.fetch(current);
      } catch {
        continue;
      }

      pages.push({
        url: page.url,
        title: page.title,
        textLength: page.text.length
      });
      combinedParts.push(page.text);

      for (const link of page.links) {
        let normalized: URL;
        try {
          normalized = new URL(link);
        } catch {
          continue;
        }

        const href = normalized.href;
        discovered.add(href);

        if (normalized.hostname !== start.hostname) {
          continue;
        }
        if (linkPattern && !linkPattern.test(href)) {
          continue;
        }
        if (visited.has(href) || queue.includes(href)) {
          continue;
        }

        queue.push(href);
      }
    }

    const combinedText = truncate(combinedParts.join('\n\n'), MAX_CRAWL_COMBINED_TEXT);

    return JSON.stringify(
      {
        pagesVisited: pages.length,
        pages,
        combinedText,
        discoveredUrls: [...discovered]
      },
      null,
      2
    );
  }

  private async discoverDocs(args: Record<string, unknown>): Promise<string> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return JSON.stringify({ error: 'Missing required argument: query' });
    }

    const maxResults =
      typeof args.max_results === 'number' && Number.isFinite(args.max_results)
        ? Math.max(1, Math.floor(args.max_results))
        : 5;

    const configured = this.sgaConfig.get('search.url');
    const searchBase =
      typeof configured === 'string' && configured.trim().length > 0
        ? configured.trim()
        : process.env.SEARCH_ENGINE_URL?.trim();

    if (!searchBase) {
      return JSON.stringify(
        {
          error:
            'No search engine configured. Set search.url in config: mcp-claw config set search.url https://your-search-engine/search'
        },
        null,
        2
      );
    }

    let endpoint: string;
    try {
      endpoint = deriveSgaSearchEndpoint(searchBase);
    } catch {
      return JSON.stringify({ error: `Invalid search.url: ${searchBase}` }, null, 2);
    }

    const searchUrl = new URL(endpoint);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('limit', String(maxResults));
    searchUrl.searchParams.set('preset', 'general');
    searchUrl.searchParams.set('sort', 'relevance');
    searchUrl.searchParams.set('depth', 'basic');

    const response = await this.httpTool.request({
      url: searchUrl.toString(),
      method: 'GET',
      timeoutMs: 10_000
    });

    if (response.status >= 400) {
      return JSON.stringify(
        {
          query,
          error: `Search request failed with HTTP ${response.status}`
        },
        null,
        2
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return JSON.stringify(
        {
          query,
          error: 'Search engine returned non-JSON response'
        },
        null,
        2
      );
    }

    const parsedResults = parseSearchPayload(parsed, maxResults);

    return JSON.stringify(
      {
        query,
        results: parsedResults.results,
        suggestions: parsedResults.suggestions
      },
      null,
      2
    );
  }

  private async sgaSearch(args: Record<string, unknown>): Promise<string> {
    const query = typeof args.q === 'string' ? args.q.trim() : '';
    if (!query) {
      return JSON.stringify({ error: 'Missing required argument: q' });
    }

    const preset =
      typeof args.preset === 'string' && ['chinese', 'wechat', 'general'].includes(args.preset)
        ? args.preset
        : 'chinese';
    const limit = Math.min(
      MAX_SGA_SEARCH_LIMIT,
      Math.max(1, Math.floor(toNumber(args.limit, DEFAULT_SGA_SEARCH_LIMIT)))
    );
    const sort =
      typeof args.sort === 'string' && ['time', 'relevance'].includes(args.sort)
        ? args.sort
        : 'time';
    const depth =
      typeof args.depth === 'string' && ['basic', 'enriched'].includes(args.depth)
        ? args.depth
        : 'basic';

    const configured = this.sgaConfig.get('search.url');
    const searchBase =
      typeof configured === 'string' && configured.trim().length > 0
        ? configured.trim()
        : process.env.SEARCH_ENGINE_URL?.trim();

    if (!searchBase) {
      return JSON.stringify(
        {
          error:
            'No search engine configured. Set search.url in config: mcp-claw config set search.url https://your-search-engine/search'
        },
        null,
        2
      );
    }

    let endpoint: string;
    try {
      endpoint = deriveSgaSearchEndpoint(searchBase);
    } catch {
      return JSON.stringify({ error: `Invalid search.url: ${searchBase}` }, null, 2);
    }

    const url = new URL(endpoint);
    url.searchParams.set('q', query);
    url.searchParams.set('preset', preset);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', sort);
    url.searchParams.set('depth', depth);

    const response = await this.httpTool.request({
      url: url.toString(),
      method: 'GET',
      timeoutMs: 10_000
    });

    if (response.status >= 400) {
      return JSON.stringify(
        {
          query,
          error: `Search request failed with HTTP ${response.status}`
        },
        null,
        2
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return JSON.stringify(
        {
          query,
          error: 'Search engine returned non-JSON response'
        },
        null,
        2
      );
    }

    const parsedResults = parseSearchPayload(parsed, limit);
    return JSON.stringify(
      {
        query,
        total: parsedResults.total,
        results: parsedResults.results,
        suggestions: parsedResults.suggestions
      },
      null,
      2
    );
  }

  private async parseOpenApi(args: Record<string, unknown>): Promise<string> {
    const source = typeof args.source === 'string' ? args.source.trim() : '';
    if (!source) {
      return JSON.stringify({ error: 'Missing required argument: source' });
    }

    const maxEndpoints = Math.max(
      1,
      Math.floor(
        typeof args.max_endpoints === 'number' && Number.isFinite(args.max_endpoints)
          ? args.max_endpoints
          : DEFAULT_OPENAPI_MAX_ENDPOINTS
      )
    );

    let content = '';
    try {
      if (/^https?:\/\//i.test(source)) {
        const response = await this.httpTool.request({
          url: source,
          method: 'GET',
          timeoutMs: 10_000
        });
        content = response.body;
      } else {
        const filePath = this.resolvePath(source);
        content = await this.fsTool.readFile(filePath);
      }
    } catch (error) {
      return JSON.stringify({ error: formatError(error), rawPreview: '' }, null, 2);
    }

    let document: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(content) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        document = parsed as Record<string, unknown>;
      }
    } catch {
      // Try minimal YAML parse below.
    }

    if (!document) {
      const trimmed = content.trimStart();
      if (/^(openapi|swagger)\s*:/i.test(trimmed)) {
        document = parseMinimalOpenApiYaml(content);
      } else {
        return JSON.stringify(
          {
            error: 'Failed to parse as JSON or recognizable OpenAPI YAML',
            rawPreview: content.slice(0, 1000)
          },
          null,
          2
        );
      }
    }

    const info = asRecord(document.info);
    const servers = Array.isArray(document.servers)
      ? document.servers.map((server) => {
          const row = asRecord(server);
          return {
            url: toStringValue(row.url),
            description: toStringValue(row.description)
          };
        })
      : [];
    const filteredServers = servers.filter((server) => server.url.length > 0);
    const auth = extractAuthSchemes(document);
    const extracted = extractOpenApiEndpoints(document, maxEndpoints);
    const components = asRecord(document.components);
    const models = Object.keys(asRecord(components.schemas));

    return JSON.stringify(
      {
        title: toStringValue(info.title),
        version: toStringValue(info.version),
        description: toStringValue(info.description),
        baseUrl: filteredServers[0]?.url ?? '',
        auth,
        endpointCount: extracted.endpointCount,
        endpoints: extracted.endpoints,
        models
      },
      null,
      2
    );
  }

  private async runShellCommand(args: Record<string, unknown>): Promise<string> {
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    if (!command) {
      return JSON.stringify({ error: 'Missing required argument: command' });
    }

    const cwdValue =
      typeof args.cwd === 'string' && args.cwd.trim()
        ? args.cwd.trim()
        : (this.lastGeneratedDir ?? this.config.workDir);
    const cwd = this.resolvePath(cwdValue);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 120_000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      });

      // Capture both stdout and stderr 鈥?compilers (tsc) write errors to stderr
      const output = [stdout, stderr].filter(Boolean).join('\n');
      return JSON.stringify(
        {
          status: 'ok',
          cwd,
          command,
          output: truncate(output, MAX_TEST_OUTPUT)
        },
        null,
        2
      );
    } catch (error: unknown) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        code?: number | string | null;
      };
      const rawStdout = (execError.stdout ?? '').trim();
      const rawStderr = (execError.stderr ?? '').trim();
      // Node.js appends stderr to error.message: "Command failed: <cmd>\n<stderr>"
      // Extract the part after the first line as fallback.
      const msgLines = (execError.message ?? '').split('\n');
      const msgRemainder = msgLines.slice(1).join('\n').trim();

      let output = [rawStdout, rawStderr, msgRemainder].filter(Boolean).join('\n').trim();

      // Detect V8 heap OOM crashes, which can produce no captured stdout/stderr.
      if (!output || output === execError.message) {
        const isOom =
          execError.code === null ||
          execError.code === undefined ||
          String(execError.code) === 'null' ||
          (execError.killed === false && !rawStdout && !rawStderr);

        if (isOom && (command.includes('tsc') || command.includes('npx'))) {
          output = [
            'Command crashed with no output - likely JavaScript heap out of memory (V8 OOM).',
            '',
            'DIAGNOSIS: TypeScript type-checking consumed too much memory.',
            'COMMON CAUSE: zodToJsonSchema() called with complex Zod schemas causes recursive type inference.',
            'FIX: In server.ts, replace:',
            '  zodToJsonSchema(mySchema) as Tool["inputSchema"]',
            'with:',
            '  (zodToJsonSchema as (s: unknown) => Tool["inputSchema"])(mySchema)',
            '',
            'Or add this helper before the tools array:',
            '  function toInputSchema(schema: unknown): Tool["inputSchema"] {',
            '    return zodToJsonSchema(schema as Parameters<typeof zodToJsonSchema>[0]) as Tool["inputSchema"];',
            '  }',
            'Then use: toInputSchema(mySchema)'
          ].join('\n');
        } else {
          output = execError.message ?? String(error);
        }
      }

      return JSON.stringify(
        {
          status: 'error',
          cwd,
          command,
          output: truncate(output, MAX_TEST_OUTPUT)
        },
        null,
        2
      );
    }
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

    const result = await this.generate({
      source,
      output: resolvedOutput,
      logger: { log: (line: string) => logs.push(line) }
    });

    this.lastSource = source;
    this.lastGeneratedDir = result.root;

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

  private async recordLearning(args: Record<string, unknown>): Promise<string> {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const problem = typeof args.problem === 'string' ? args.problem.trim() : '';
    const fix = typeof args.fix === 'string' ? args.fix.trim() : '';

    if (!title || !problem || !fix) {
      return JSON.stringify({ error: 'title, problem, and fix are all required' });
    }

    const patternsDir = join(this.config.workDir, '.mcp-claw');
    const patternsFile = join(patternsDir, 'patterns.md');

    if (!existsSync(patternsDir)) {
      mkdirSync(patternsDir, { recursive: true });
    }

    const tags = Array.isArray(args.tags)
      ? (args.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    const date = new Date().toISOString().split('T')[0];
    const entry = [
      `\n## ${title} (${date})`,
      `**Problem**: ${problem}`,
      `**Fix**: ${fix}`,
      ...(tags.length > 0 ? [`**Tags**: ${tags.join(', ')}`] : []),
      ''
    ].join('\n');

    const existing = existsSync(patternsFile)
      ? readFileSync(patternsFile, 'utf8')
      : '# Learned Patterns\n';
    writeFileSync(patternsFile, existing + entry, 'utf8');

    return JSON.stringify(
      { status: 'ok', message: `Pattern "${title}" saved`, file: patternsFile },
      null,
      2
    );
  }

  /** Return the last N conversation rounds for display (user+assistant pairs). */
  public getRecentRounds(
    maxRounds: number
  ): Array<{ userText: string; assistantText: string; toolCount: number }> {
    const rounds: Array<{ userText: string; assistantText: string; toolCount: number }> = [];
    let i = 0;
    while (i < this.history.length) {
      const msg = this.history[i];
      if (msg.role === 'user') {
        const userText = typeof msg.content === 'string' ? msg.content : '';
        let assistantText = '';
        let toolCount = 0;
        let j = i + 1;
        while (j < this.history.length && this.history[j].role !== 'user') {
          const m = this.history[j];
          if (m.role === 'assistant') {
            if (typeof m.content === 'string' && m.content.trim()) {
              assistantText = m.content;
            }
            toolCount += Array.isArray(m.tool_calls) ? m.tool_calls.length : 0;
          }
          j++;
        }
        rounds.push({ userText, assistantText, toolCount });
        i = j;
      } else {
        i++;
      }
    }
    return rounds.slice(-maxRounds);
  }

  /** Switch the LLM model at runtime. Returns the new model name. */
  public setModel(model: string): string {
    this.llm = new OpenRouterProvider(
      'openrouter-chat',
      model,
      this.config.apiKey,
      this.config.baseUrl
    );
    this.cachedSystemPrompt = undefined; // rebuild on next send
    return model;
  }

  public clearHistory(): void {
    this.history.length = 0;
    this.lastSource = undefined;
    this.lastGeneratedDir = undefined;
    this.persistState();
  }

  private persistState(): void {
    try {
      savePersistedState(this.config.workDir, {
        history: this.history,
        lastSource: this.lastSource,
        lastGeneratedDir: this.lastGeneratedDir
      });
    } catch {
      // Non-critical 鈥?don't break the session if we can't save
    }
  }

  private writeAssistant(text: string): void {
    this.output.write('\n');
    for (const line of text.split('\n')) {
      this.output.write(`  ${line}\n`);
    }
    this.output.write('\n');
  }

  private writeToolStart(name: string, args: Record<string, unknown>): void {
    const summary = this.toolArgsSummary(name, args);
    this.output.write(
      `  ${chalk.dim('...')} ${chalk.cyan(name)}${summary ? chalk.gray(` ${summary}`) : ''}\n`
    );
  }

  private writeToolDone(name: string, result: string): void {
    try {
      const parsed = JSON.parse(result) as Record<string, unknown>;
      if (parsed.error) {
        this.output.write(`    ${chalk.red('x')} ${chalk.red(String(parsed.error))}\n`);
      } else {
        const info = this.toolResultSummary(name, parsed);
        this.output.write(`    ${chalk.green('ok')} ${chalk.dim(info)}\n`);
      }
    } catch {
      const preview = result.length > 80 ? `${result.slice(0, 80)}...` : result;
      this.output.write(`    ${chalk.green('ok')} ${chalk.dim(preview)}\n`);
    }
  }

  private toolArgsSummary(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'read_folder':
      case 'read_file':
      case 'write_file':
      case 'read_pdf':
        return typeof args.path === 'string' ? args.path : '';
      case 'search_files': {
        const pattern = typeof args.pattern === 'string' ? args.pattern : '';
        const pathValue = typeof args.path === 'string' ? args.path : 'project';
        return `${pattern} in ${pathValue}`.trim();
      }
      case 'fetch_url':
        return typeof args.url === 'string' ? args.url : '';
      case 'http_request': {
        const method = typeof args.method === 'string' ? args.method.toUpperCase() : 'GET';
        const url = typeof args.url === 'string' ? args.url : '';
        return `${method} ${url}`.trim();
      }
      case 'crawl_docs': {
        const startUrl = typeof args.start_url === 'string' ? args.start_url : '';
        const maxPages =
          typeof args.max_pages === 'number' ? args.max_pages : DEFAULT_DOC_CRAWL_PAGES;
        return `${startUrl} (max ${maxPages} pages)`;
      }
      case 'discover_docs':
        return typeof args.query === 'string' ? args.query : '';
      case 'sga_search': {
        const query = typeof args.q === 'string' ? args.q : '';
        const preset = typeof args.preset === 'string' ? args.preset : 'chinese';
        return `${query} (${preset})`.trim();
      }
      case 'parse_openapi':
        return typeof args.source === 'string' ? args.source : '';
      case 'run_command':
        return typeof args.command === 'string' ? args.command : '';
      case 'generate_mcp':
        return typeof args.source === 'string' ? args.source : '';
      case 'run_tests':
      case 'test_integration':
        return typeof args.dir === 'string' ? args.dir : '';
      case 'record_learning':
        return typeof args.title === 'string' ? args.title : '';
      default:
        return '';
    }
  }

  private toolResultSummary(name: string, result: Record<string, unknown>): string {
    switch (name) {
      case 'read_folder': {
        const count = typeof result.fileCount === 'number' ? result.fileCount : '?';
        return `${count} files`;
      }
      case 'read_file': {
        const len = typeof result.length === 'number' ? result.length : '?';
        return `${len} chars`;
      }
      case 'write_file': {
        const bytes = typeof result.bytes === 'number' ? result.bytes : '?';
        return `${bytes} bytes written`;
      }
      case 'search_files': {
        const total = typeof result.totalMatches === 'number' ? result.totalMatches : 0;
        return `${total} matches`;
      }
      case 'read_pdf': {
        const length = typeof result.length === 'number' ? result.length : 0;
        return `${length} chars extracted`;
      }
      case 'fetch_url':
        return typeof result.title === 'string' ? result.title : 'fetched';
      case 'http_request': {
        const status = typeof result.status === 'number' ? result.status : '?';
        return `HTTP ${status}`;
      }
      case 'crawl_docs': {
        const pagesVisited = typeof result.pagesVisited === 'number' ? result.pagesVisited : 0;
        const combinedLength =
          typeof result.combinedText === 'string' ? result.combinedText.length : 0;
        return `${pagesVisited} pages, ${combinedLength} chars`;
      }
      case 'discover_docs': {
        const results = Array.isArray(result.results) ? result.results : [];
        const count = results.length;
        const urls = results
          .map((entry) =>
            entry && typeof entry === 'object' ? (entry as Record<string, unknown>).url : undefined
          )
          .filter((url): url is string => typeof url === 'string')
          .slice(0, 3);
        return `${count} results found${urls.length > 0 ? `: ${urls.join(', ')}` : ''}`;
      }
      case 'sga_search': {
        const total = typeof result.total === 'number' ? result.total : 0;
        return `${total} results`;
      }
      case 'parse_openapi': {
        const endpointCount = typeof result.endpointCount === 'number' ? result.endpointCount : 0;
        const auth = Array.isArray(result.auth)
          ? result.auth.filter((item): item is string => typeof item === 'string')
          : [];
        return `${endpointCount} endpoints, ${auth.length > 0 ? auth.join('+') : 'no auth'}`;
      }
      case 'run_command': {
        if (result.status === 'ok') {
          const firstLine =
            typeof result.output === 'string'
              ? (result.output.split('\n').find((l: string) => l.trim()) ?? '').slice(0, 60)
              : '';
          return `exit 0${firstLine ? ` | ${firstLine}` : ''}`;
        }
        const errorOutput = typeof result.output === 'string' ? result.output : '';
        // Show first 3 meaningful error lines (joined with ' | '), max 300 chars
        const meaningfulLines = errorOutput
          .split('\n')
          .map((l: string) => l.trim())
          .filter(
            (l: string) =>
              l &&
              !l.startsWith('Command failed') &&
              !l.startsWith('npm warn') &&
              !l.startsWith('npm notice')
          );
        const errorSummary = meaningfulLines.slice(0, 3).join(' | ');
        return `error · ${(errorSummary || errorOutput).slice(0, 300)}`;
      }
      case 'generate_mcp': {
        const logs = Array.isArray(result.logs) ? result.logs : [];
        return logs.length > 0 ? String(logs[logs.length - 1]) : 'done';
      }
      case 'run_tests':
        return typeof result.output === 'string'
          ? (result.output.split('\n')[0] ?? 'done')
          : 'done';
      case 'test_integration': {
        const passed = result.passed === true ? 'PASS' : 'FAIL';
        const tools = typeof result.toolsFound === 'number' ? result.toolsFound : 0;
        return `${passed} 路 ${tools} tools`;
      }
      case 'publish_mcp':
        return result.status === 'ok' ? 'published' : 'done';
      case 'show_history':
        return 'loaded';
      case 'record_learning':
        return result.status === 'ok' ? `recorded: ${String(result.message ?? 'done')}` : 'done';
      default:
        return 'done';
    }
  }
}
