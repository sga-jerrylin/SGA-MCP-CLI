import type { ApiResponse, SseErrorEvent, SseEvent } from '@mcp-claw/shared';

export interface RunCommandInput {
  root: string;
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

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
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
    const response = await postJson<ApiResponse<CliRunCreateResponse>>(`${baseUrl}/monitor/cli-runs`, {
      root
    });
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
  const reporter = await createReporter(input.reportTo, input.root);
  await reporter.reportEvent({
    type: 'log',
    level: 'info',
    message: `CLI run started for ${input.root}`,
    timestamp: nowIso()
  });

  try {
    input.logger.log(`Running MCP Claw against ${input.root}`);
    await reporter.reportEvent({
      type: 'done',
      projectId: reporter.runId ?? 'cli-run',
      artifactCount: 0
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorEvent: SseErrorEvent = {
      type: 'error',
      message
    };
    await reporter.reportEvent(errorEvent);
    throw error;
  }
}
