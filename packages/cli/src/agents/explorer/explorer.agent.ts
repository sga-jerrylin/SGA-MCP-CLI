import { DockerInspectTool, type DockerContainerInfo } from '../../tools/docker-tool';
import { FsTool } from '../../tools/fs-tool';
import { HttpFetchTool, type HttpFetchResult } from '../../tools/http-tool';

export interface ExplorerRunInput {
  root: string;
  urls: string[];
}

export interface ExplorerReport {
  files: string[];
  containers: DockerContainerInfo[];
  endpoints: HttpFetchResult[];
}

export interface ExplorerDeps {
  fsTool: Pick<FsTool, 'glob'>;
  dockerTool: Pick<DockerInspectTool, 'listContainers'>;
  httpTool: Pick<HttpFetchTool, 'fetch'>;
}

export class ExplorerAgent {
  public constructor(
    private readonly deps: ExplorerDeps = {
      fsTool: new FsTool(),
      dockerTool: new DockerInspectTool(),
      httpTool: new HttpFetchTool()
    }
  ) {}

  public async run(input: ExplorerRunInput): Promise<ExplorerReport> {
    const [files, containers, endpoints] = await Promise.all([
      this.deps.fsTool.glob(input.root, ['*.md', 'openapi*.json', 'docker-compose*.yml']),
      this.deps.dockerTool.listContainers(),
      Promise.all(input.urls.map((url) => this.deps.httpTool.fetch(url)))
    ]);

    return {
      files: [...files].sort(),
      containers: [...containers].sort((a, b) => a.id.localeCompare(b.id)),
      endpoints: [...endpoints].sort((a, b) => a.url.localeCompare(b.url))
    };
  }
}
