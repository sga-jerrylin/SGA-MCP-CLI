export interface RunRecord {
  id: string;
  source: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failed';
  ir?: {
    system: { code: string; baseUrl: string; authType: string };
    toolCount: number;
    toolNames: string[];
  };
  filesWritten: string[];
  errorMessage?: string;
  durationMs: number;
}
