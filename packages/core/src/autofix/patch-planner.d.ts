export interface PatchRequest {
    reason: string;
    maxFiles: number;
}
export declare function createPatchRequest(logs: string[], maxFiles?: number): PatchRequest;
