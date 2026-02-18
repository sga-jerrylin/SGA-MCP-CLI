import type { SandboxPort, SandboxRunRequest, SandboxRunResult } from './sandbox-port';
export declare class SandboxHttpAdapter implements SandboxPort {
    private readonly baseUrl;
    private readonly fetchImpl;
    constructor(baseUrl: string, fetchImpl: typeof fetch);
    runTests(req: SandboxRunRequest): Promise<SandboxRunResult>;
}
