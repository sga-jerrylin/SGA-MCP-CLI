import type { SandboxPort, SandboxRunRequest, SandboxRunResult } from './sandbox-port';
import { withTimeout } from './sandbox-port';

export class SandboxHttpAdapter implements SandboxPort {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch
  ) {}

  public async runTests(req: SandboxRunRequest): Promise<SandboxRunResult> {
    const response = await withTimeout(
      this.fetchImpl(`${this.baseUrl}/run-tests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(req)
      }),
      req.timeoutMs,
      'SANDBOX_TIMEOUT'
    );

    if (!response.ok) {
      throw new Error(`SANDBOX_HTTP_${response.status}`);
    }

    return (await response.json()) as SandboxRunResult;
  }
}
