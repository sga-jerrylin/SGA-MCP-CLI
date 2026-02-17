export interface PatchRequest {
  reason: string;
  maxFiles: number;
}

export function createPatchRequest(logs: string[], maxFiles = 5): PatchRequest {
  return {
    reason: logs.slice(-20).join('\n'),
    maxFiles
  };
}
