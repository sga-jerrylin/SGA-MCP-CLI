import { composeUp } from './docker.runner';
import type { ComposeService } from './compose.renderer';
import { renderCompose } from './compose.renderer';
import { waitHealthy } from './health-checker';

export interface DeployerDeps {
  render: (services: ComposeService[]) => string;
  up: (composeFile: string) => Promise<void>;
  verify: (urls: string[]) => Promise<{ ok: boolean; failed: string[] }>;
}

export class DeployerAgent {
  public constructor(
    private readonly deps: DeployerDeps = {
      render: renderCompose,
      up: composeUp,
      verify: (urls) => waitHealthy(urls, 10)
    }
  ) {}

  public async run(opts: {
    composeFile: string;
    services: ComposeService[];
    healthUrls: string[];
  }): Promise<{ ok: boolean; failed: string[] }> {
    this.deps.render(opts.services);
    await this.deps.up(opts.composeFile);
    return this.deps.verify(opts.healthUrls);
  }
}
