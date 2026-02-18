/**
 * MCP Claw / Hub 共享类型定义
 *
 * 从 api-contract.yaml 手动同步。
 * 前后端必须引用此文件，不可自行定义重复类型。
 */

// ── Common ──────────────────────────────────

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedList<T = any> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Auth ────────────────────────────────────

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  avatar?: string;
  tenantId?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ── Generator ───────────────────────────────

export type ProjectStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'testing'
  | 'fixing'
  | 'done'
  | 'failed';
export type DocType = 'markdown' | 'openapi' | 'auto';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  docType: DocType;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  runs: GenerateRun[];
  artifacts: Artifact[];
}

export type RunStatus = 'queued' | 'running' | 'done' | 'failed';

export interface GenerateRun {
  id: string;
  projectId: string;
  status: RunStatus;
  parserModel: string;
  coderModel: string;
  fixRounds: number;
  startedAt: string;
  finishedAt?: string;
}

export interface StartGenerateRequest {
  parserModel?: string;
  coderModel?: string;
  maxFixRounds?: number;
}

export type ArtifactType = 'connector' | 'test' | 'config' | 'package';

export interface Artifact {
  id: string;
  runId: string;
  type: ArtifactType;
  fileName: string;
  size: number;
  createdAt: string;
}

// ── SSE Events ──────────────────────────────

export type SseEventType = 'log' | 'progress' | 'step_change' | 'done' | 'error';

export interface SseLogEvent {
  type: 'log';
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export interface SseProgressEvent {
  type: 'progress';
  percent: number;
  stage: 'parsing' | 'generating' | 'testing' | 'fixing' | 'packaging';
}

export interface SseStepChangeEvent {
  type: 'step_change';
  step: number;
  name: string;
  status: 'running' | 'done' | 'failed';
}

export interface SseDoneEvent {
  type: 'done';
  projectId: string;
  artifactCount: number;
}

export interface SseErrorEvent {
  type: 'error';
  message: string;
  details?: string;
}

export type SseEvent =
  | SseLogEvent
  | SseProgressEvent
  | SseStepChangeEvent
  | SseDoneEvent
  | SseErrorEvent;

// ── Runtime (MCP Servers) ───────────────────

export type ServerStatus = 'healthy' | 'degraded' | 'stopped' | 'deploying';

export interface McpServer {
  id: string;
  name: string;
  shardIndex: number;
  status: ServerStatus;
  toolCount: number;
  tokenUsage: number;
  tokenBudget: number;
  endpoint: string;
  port: number;
  createdAt: string;
}

export interface McpServerDetail extends McpServer {
  tools: McpTool[];
  metrics: {
    qps: number;
    p95Latency: number;
    errorRate: number;
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  estimatedTokens?: number;
}

export interface ToolsListResponse {
  tools: McpTool[];
  tokenUsage: number;
  tokenBudget: number;
}

// ── Deploy ──────────────────────────────────

export interface DeployPreviewRequest {
  serverIds: string[];
}

export interface DeployPreview {
  composeYaml: string;
  nginxConf: string;
  servers: Array<{
    serverId: string;
    name: string;
    port: number;
    toolCount: number;
  }>;
}

export interface DeployExecuteRequest {
  serverIds: string[];
  composeOverride?: string;
}

export type DeployStatus = 'pending' | 'pulling' | 'starting' | 'verifying' | 'done' | 'failed';

export interface DeployTask {
  id: string;
  status: DeployStatus;
  serverIds: string[];
  startedAt: string;
}

// ── Repository ──────────────────────────────

export interface Package {
  id: string;
  name: string;
  version: string;
  description?: string;
  category: string;
  toolCount: number;
  serverCount: number;
  sha256: string;
  signature?: string;
  signed: boolean;
  downloads: number;
  publishedAt: string;
}

// ── Sync (CLI ↔ Hub) ───────────────────────

export interface SyncPushResponse {
  packageId: string;
  servers: Array<{
    serverId: string;
    name: string;
    toolCount: number;
  }>;
  deployed: boolean;
}

// ── Admin ───────────────────────────────────

export type TenantStatus = 'active' | 'disabled';

export interface Tenant {
  id: string;
  name: string;
  contact: string;
  status: TenantStatus;
  createdAt: string;
}

export interface CreateTenantRequest {
  name: string;
  contact: string;
  domain?: string;
}

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  lastUsedAt?: string;
  status: ApiKeyStatus;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresIn?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string; // 完整Key，仅创建时可见
  prefix: string;
  expiresAt: string;
}

// ── Monitor ─────────────────────────────────

export type MetricsRange = '1h' | '6h' | '24h' | '7d';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface LatencyPoint {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
}

export interface MemoryPoint {
  timestamp: string;
  usedMb: number;
  totalMb: number;
}

export type AgentRunStatus = 'running' | 'done' | 'error';

export interface AgentRun {
  runId: string;
  root: string;
  status: AgentRunStatus;
  startedAt: string;
  eventCount: number;
}

export interface SystemMetricsSnapshot {
  uptime: number;
  memUsed: number;
  activeRequests: number;
  totalPackages: number;
  totalServers: number;
}

export interface ToolCallStat {
  toolName: string;
  serverId: string;
  serverName: string;
  callCount: number;
  lastCalledAt: string;
}

export interface HourlyCount {
  hour: string;
  count: number;
}

export interface DashboardSummary {
  topTools: ToolCallStat[];
  totalCallsLast24h: number;
  hourlyTrend: HourlyCount[];
  activeServers: number;
  totalPackages: number;
  uptimeSeconds: number;
  memUsedMb: number;
}

export interface Metrics {
  summary: {
    totalServers: number;
    activeServers: number;
    totalTools: number;
    totalRequests: number;
  };
  qps: TimeSeriesPoint[];
  latency: LatencyPoint[];
  memory: MemoryPoint[];
}
