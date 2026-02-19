/**
 * 前端类型定义
 *
 * 共享类型从 @sga/shared 重新导出，禁止在此重复定义。
 * 仅在此文件中添加前端专用类型。
 */

// ── 重新导出共享类型 ────────────────────────────
export type {
  ApiResponse,
  PaginatedList,
  User,
  LoginRequest,
  LoginResponse,
  Project,
  ProjectDetail,
  ProjectStatus,
  DocType,
  GenerateRun,
  RunStatus,
  StartGenerateRequest,
  Artifact,
  ArtifactType,
  SseEvent,
  SseLogEvent,
  SseProgressEvent,
  SseStepChangeEvent,
  SseDoneEvent,
  SseErrorEvent,
  McpServer,
  McpServerDetail,
  McpTool,
  ToolsListResponse,
  DeployPreview,
  DeployPreviewRequest,
  DeployExecuteRequest,
  DeployTask,
  DeployStatus,
  Package,
  Tenant,
  TenantStatus,
  ApiKey,
  ApiKeyStatus,
  Metrics,
  MetricsRange,
  TimeSeriesPoint,
  LatencyPoint,
  MemoryPoint
} from '@sga/shared';

// ── 前端专用类型 ────────────────────────────────

/** 主题模式 */
export type ThemeMode = 'light' | 'dark';

/** 侧边栏菜单项 */
export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  path: string;
  children?: MenuItem[];
}

/** 面包屑项 */
export interface BreadcrumbItem {
  title: string;
  path?: string;
}
