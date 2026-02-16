import type {
  ApiResponse,
  GenerateRun,
  LoginResponse,
  StartGenerateRequest,
  SyncPushResponse,
} from '../../../shared/types/api.ts';

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, message: 'ok', data };
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createLoginResponseFixture(): ApiResponse<LoginResponse> {
  return ok({
    token: 'eyJhbGciOi.mock',
    user: {
      id: 'u_001',
      username: 'admin',
      role: 'admin',
      tenantId: 't_001',
    },
  });
}

export function createStartGenerateAcceptedFixture(
  request: StartGenerateRequest,
): ApiResponse<GenerateRun> {
  return ok({
    id: 'run_001',
    projectId: 'p_001',
    status: 'queued',
    parserModel: request.parserModel ?? 'claude-3-haiku',
    coderModel: request.coderModel ?? 'claude-3-5-sonnet',
    fixRounds: request.maxFixRounds ?? 3,
    startedAt: nowIso(),
  });
}

export function createSyncPushFixture(): ApiResponse<SyncPushResponse> {
  return ok({
    packageId: 'pkg_001',
    servers: [
      {
        serverId: 's_01',
        name: 'erp-shard',
        toolCount: 18,
      },
    ],
    deployed: false,
  });
}

export function createSyncPullMetaFixture(packageId: string) {
  return {
    packageId,
    contentType: 'application/octet-stream',
    downloadPath: `E:/mcp/.tmp/${packageId}.tar.gz`,
  };
}
