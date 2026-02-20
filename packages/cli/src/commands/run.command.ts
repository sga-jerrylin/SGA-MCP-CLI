import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SgaConfig } from '../config/sga-config';
import {
  buildCodegenPrompt,
  InMemoryPackager,
  type IR,
  McpClawCore,
  parseGeneratedFiles,
  type PackageBuildInput,
  type PackageBuildResult
} from '@sga/core';
import type { ApiResponse, SseErrorEvent, SseEvent } from '@sga/shared';

import { ArchitectAgent } from '../agents/architect/architect.agent';
import { LlmIrGenerator } from '../agents/architect/llm-ir-generator';
import { BuilderAgent } from '../agents/builder/builder.agent';
import { CoreCodegenAdapter } from '../agents/builder/core-codegen.adapter';
import { DependencyInstaller } from '../agents/builder/dependency-installer';
import { ExplorerAgent } from '../agents/explorer/explorer.agent';
import type { RunRecord } from '../memory/run-record';
import { SessionWriter } from '../memory/session-writer';
import { TestRunner } from '../agents/tester/test-runner';
import { TesterSandboxAdapter } from '../agents/tester/sandbox.adapter';
import { TesterAgent } from '../agents/tester/tester.agent';
import { OpenRouterProvider } from '../llm/llm-client';
import { BrowserTool } from '../tools/browser-tool';
import { DockerInspectTool } from '../tools/docker-tool';
import { FsTool } from '../tools/fs-tool';
import { HttpFetchTool } from '../tools/http-tool';
import { PdfTool } from '../tools/pdf-tool';
import { writeManifest } from '../utils/manifest-writer';
import { PipelineProgress } from '../utils/pipeline-progress';

export interface RunCommandInput {
  root: string;
  urls?: string[];
  dryRun?: boolean;
  logger: Pick<Console, 'log'>;
  reportTo?: string;
}

interface CliRunCreateResponse {
  runId: string;
}

interface CliRunEventResponse {
  ok: boolean;
}

interface RunReporter {
  reportEvent: (event: SseEvent) => Promise<void>;
  runId?: string;
}

const DEFAULT_CODER_MODEL = 'anthropic/claude-sonnet-4.5';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function loadEnvConfig(startRoot: string, maxLevels = 5): Map<string, string> {
  let currentDir = resolve(startRoot);

  for (let level = 0; level <= maxLevels; level += 1) {
    const envPath = resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const values = new Map<string, string>();

      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) {
          values.set(match[1], match[2]);
        }
      }

      return values;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  return new Map<string, string>();
}

function defaultIr(): IR {
  return {
    system: {
      code: 'generated-system',
      baseUrl: 'https://example.local',
      authType: 'none'
    },
    tools: [
      {
        name: 'default_tool',
        description: 'Fallback generated tool',
        method: 'GET',
        path: '/health',
        needsConfirmation: false,
        isAsync: false,
        params: []
      }
    ]
  };
}

function isIR(value: unknown): value is IR {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    system?: { code?: unknown; baseUrl?: unknown; authType?: unknown };
    tools?: unknown;
  };

  return (
    typeof candidate.system?.code === 'string' &&
    typeof candidate.system?.baseUrl === 'string' &&
    typeof candidate.system?.authType === 'string' &&
    Array.isArray(candidate.tools)
  );
}

function parsePlanDoc(planDoc: string): IR {
  const trimmed = planDoc.trim();
  if (!trimmed) {
    return defaultIr();
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isIR(parsed)) {
      return parsed;
    }
  } catch {
    // fall back to deterministic IR below
  }

  return defaultIr();
}

function createCore(options: { dryRun: boolean; llmProvider?: OpenRouterProvider }): McpClawCore {
  const packager = new InMemoryPackager();

  return new McpClawCore({
    parse: async (input: { kind: 'markdown' | 'openapi'; content: string }) =>
      parsePlanDoc(input.content),
    codegen: async (ir: IR) => {
      if (options.dryRun || !options.llmProvider) {
        return [];
      }

      const prompt = buildCodegenPrompt(ir);
      const generated = await options.llmProvider.complete(prompt);
      return parseGeneratedFiles(generated);
    },
    sandbox: {
      runTests: async () => ({
        passed: true,
        logs: [],
        failedTests: []
      })
    },
    packager: {
      build: async (input: PackageBuildInput) => {
        const artifact = await packager.build(input);
        return {
          ...artifact,
          files: input.files
        } as PackageBuildResult;
      }
    }
  });
}

function createExplorer(dryRun: boolean): ExplorerAgent {
  if (!dryRun) {
    return new ExplorerAgent({
      fsTool: new FsTool(),
      dockerTool: new DockerInspectTool(),
      httpTool: new HttpFetchTool(),
      browserTool: new BrowserTool(),
      pdfTool: new PdfTool()
    });
  }

  return new ExplorerAgent({
    fsTool: {
      glob: async () => []
    },
    dockerTool: {
      listContainers: async () => []
    },
    httpTool: {
      fetch: async (url: string) => ({
        url,
        status: 200,
        body: ''
      })
    }
  });
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as TResponse;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function createReporter(reportTo: string | undefined, root: string): Promise<RunReporter> {
  if (!reportTo) {
    return {
      reportEvent: async () => Promise.resolve()
    };
  }

  const baseUrl = normalizeBaseUrl(reportTo);

  try {
    const response = await postJson<ApiResponse<CliRunCreateResponse>>(
      `${baseUrl}/monitor/cli-runs`,
      {
        root
      }
    );
    const runId = response.data.runId;

    return {
      runId,
      reportEvent: async (event: SseEvent) => {
        try {
          await postJson<ApiResponse<CliRunEventResponse>>(
            `${baseUrl}/monitor/cli-runs/${runId}/events`,
            event
          );
        } catch {
          // reporting is best-effort and must not block CLI execution
        }
      }
    };
  } catch {
    return {
      reportEvent: async () => Promise.resolve()
    };
  }
}

export async function runCommand(input: RunCommandInput): Promise<void> {
  const startTime = Date.now();
  const source = input.urls?.[0] ?? input.root;
  const sessionWriter = new SessionWriter();
  const reporter = await createReporter(input.reportTo, input.root);
  await reporter.reportEvent({
    type: 'log',
    level: 'info',
    message: `CLI run started for ${input.root}`,
    timestamp: nowIso()
  });

  const progress = new PipelineProgress({
    silent: Boolean(input.dryRun)
  });
  let activeStage: 'Explorer' | 'Architect' | 'Builder' | 'Tester' | undefined;
  let lastIr: RunRecord['ir'] | undefined;
  let filesWritten: string[] = [];

  try {
    const env = loadEnvConfig(input.root);
    const globalConfig = new SgaConfig();
    const apiKey =
      env.get('OPENROUTER_API_KEY') ??
      process.env.OPENROUTER_API_KEY ??
      (globalConfig.get('openrouter.apiKey') as string | undefined) ??
      '';
    const coderModel =
      env.get('LLM_CODER_MODEL') ??
      process.env.LLM_CODER_MODEL ??
      (globalConfig.get('model.coder') as string | undefined) ??
      DEFAULT_CODER_MODEL;
    const baseUrl =
      env.get('OPENROUTER_BASE_URL') ??
      process.env.OPENROUTER_BASE_URL ??
      (globalConfig.get('openrouter.baseUrl') as string | undefined) ??
      DEFAULT_BASE_URL;
    const urls = input.urls ?? [];
    const llmProvider =
      !input.dryRun && apiKey
        ? new OpenRouterProvider('openrouter-coder', coderModel, apiKey, baseUrl)
        : undefined;

    activeStage = 'Explorer';
    progress.start('Explorer', 'scanning sources...');
    const explorer = createExplorer(Boolean(input.dryRun));
    const explorerReport = await explorer.run({ root: input.root, urls });
    const explorerDoneMessage = `found ${explorerReport.files.length} files`;
    progress.done('Explorer', explorerDoneMessage);
    input.logger.log(`Explorer - ${explorerDoneMessage}`);

    activeStage = 'Architect';
    progress.start('Architect', 'designing MCP tools...');
    const architect = new ArchitectAgent(
      llmProvider
        ? {
            llmIrGenerator: new LlmIrGenerator(llmProvider)
          }
        : undefined
    );
    const architectResult = await architect.run(explorerReport);
    const architectDoneMessage = `planned ${architectResult.ir.tools.length} tools`;
    progress.done('Architect', architectDoneMessage);
    input.logger.log(`Architect - ${architectDoneMessage}`);
    lastIr = {
      system: architectResult.ir.system,
      toolCount: architectResult.ir.tools.length,
      toolNames: architectResult.ir.tools.map((tool) => tool.name)
    };

    activeStage = 'Builder';
    progress.start('Builder', 'generating code...');
    const core = createCore({ dryRun: Boolean(input.dryRun), llmProvider });
    const adapter = new CoreCodegenAdapter(core);
    const installer = input.dryRun
      ? {
          install: async () => Promise.resolve()
        }
      : new DependencyInstaller();
    const builder = new BuilderAgent({ adapter, installer });
    const builderResult = await builder.run({
      root: input.root,
      planDoc: input.dryRun ? '' : JSON.stringify(architectResult.ir, null, 2)
    });
    if (!input.dryRun) {
      const manifestPath = await writeManifest(input.root, architectResult.ir);
      input.logger.log(`Builder - wrote manifest: ${manifestPath}`);
    }
    const builderDoneMessage = `wrote ${builderResult.writtenFiles.length} files`;
    progress.done('Builder', builderDoneMessage);
    input.logger.log(`Builder - ${builderDoneMessage}`);
    filesWritten = builderResult.writtenFiles;

    activeStage = 'Tester';
    progress.start('Tester', 'validating generated server...');
    const runner = input.dryRun
      ? {
          run: async () => ({
            stdout: 'Tests: 0 passed, 0 failed, 0 total\nLines : 0%'
          })
        }
      : new TestRunner();
    const tester = new TesterAgent({
      sandboxAdapter: new TesterSandboxAdapter({
        runTests: async () => ({
          passed: true,
          logs: [],
          failedTests: []
        })
      }),
      runner
    });
    const testerResult = await tester.run({
      root: input.root,
      files: builderResult.writtenFiles.map((filePath) => ({ path: filePath, content: '' }))
    });

    if (testerResult.passed) {
      progress.done('Tester', 'PASS');
      input.logger.log('Tester - PASS');
    } else {
      progress.fail('Tester', 'FAIL');
      input.logger.log('Tester - FAIL');
    }

    if (!input.dryRun) {
      const record: RunRecord = {
        id: `${Date.now()}`,
        source,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        status: testerResult.passed ? 'success' : 'failed',
        ir: lastIr,
        filesWritten,
        durationMs: Date.now() - startTime
      };
      sessionWriter.write(record, input.root);
    }

    activeStage = undefined;

    await reporter.reportEvent({
      type: 'done',
      projectId: reporter.runId ?? 'cli-run',
      artifactCount: builderResult.writtenFiles.length
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (activeStage) {
      progress.fail(activeStage, message);
      input.logger.log(`${activeStage} - ${message}`);
    }

    if (!input.dryRun) {
      const record: RunRecord = {
        id: `${Date.now()}`,
        source,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'failed',
        ir: lastIr,
        filesWritten,
        errorMessage: message,
        durationMs: Date.now() - startTime
      };

      try {
        sessionWriter.write(record, input.root);
      } catch {
        // preserving the original run failure is more important than memory persistence
      }
    }

    const errorEvent: SseErrorEvent = {
      type: 'error',
      message
    };
    await reporter.reportEvent(errorEvent);
    throw error;
  }
}
