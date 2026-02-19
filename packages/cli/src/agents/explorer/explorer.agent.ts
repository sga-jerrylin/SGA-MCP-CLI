import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import type { BrowserFetchResult } from '../../tools/browser-tool';
import { BrowserTool } from '../../tools/browser-tool';
import { DockerInspectTool, type DockerContainerInfo } from '../../tools/docker-tool';
import { FsTool } from '../../tools/fs-tool';
import { HttpFetchTool, type HttpFetchResult } from '../../tools/http-tool';
import { PdfTool } from '../../tools/pdf-tool';

const DISCOVERY_FILE_PATTERNS = [
  '*.md',
  '*.txt',
  '*.pdf',
  '*.json',
  '*.yaml',
  '*.yml',
  '*.ts',
  '*.js',
  '*.mjs',
  '*.cjs',
  '*.xml',
  '*.toml',
  '*.env',
  'openapi*.json',
  'openapi*.yaml',
  'openapi*.yml',
  'docker-compose*.yml'
];

function readTextFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export interface ExplorerRunInput {
  root: string;
  urls: string[];
}

export interface ExplorerReport {
  files: string[];
  containers: DockerContainerInfo[];
  endpoints: HttpFetchResult[];
  rawDocs?: string[];
  browserPages?: BrowserFetchResult[];
}

export interface ExplorerDeps {
  fsTool: Pick<FsTool, 'glob'>;
  dockerTool: Pick<DockerInspectTool, 'listContainers'>;
  httpTool: Pick<HttpFetchTool, 'fetch'>;
  browserTool?: Pick<BrowserTool, 'fetch'>;
  pdfTool?: Pick<PdfTool, 'extractFromFile'>;
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
    const [files, containers] = await Promise.all([
      this.deps.fsTool.glob(input.root, DISCOVERY_FILE_PATTERNS),
      this.deps.dockerTool.listContainers()
    ]);

    const endpoints: HttpFetchResult[] = [];
    const browserPages: BrowserFetchResult[] = [];
    const rawDocs: string[] = [];

    for (const url of input.urls) {
      if (this.deps.browserTool) {
        const browserResult = await this.deps.browserTool.fetch(url);
        browserPages.push(browserResult);
        endpoints.push({
          url: browserResult.url,
          status: 200,
          body: browserResult.html
        });
        if (browserResult.text.trim().length > 0) {
          rawDocs.push(browserResult.text);
        }
        continue;
      }

      const endpoint = await this.deps.httpTool.fetch(url);
      endpoints.push(endpoint);
      if (endpoint.body.trim().length > 0) {
        rawDocs.push(endpoint.body);
      }
    }

    for (const filePath of files) {
      const extension = extname(filePath).toLowerCase();

      if (extension === '.pdf') {
        if (this.deps.pdfTool) {
          try {
            const extracted = await this.deps.pdfTool.extractFromFile(filePath);
            if (extracted.text.trim().length > 0) {
              rawDocs.push(extracted.text);
            }
          } catch {
            // skip unreadable PDF files
          }
        }
        continue;
      }

      const content = readTextFile(filePath);
      if (content && content.trim().length > 0) {
        rawDocs.push(content);
      }
    }

    return {
      files: [...files].sort(),
      containers: [...containers].sort((a, b) => a.id.localeCompare(b.id)),
      endpoints: [...endpoints].sort((a, b) => a.url.localeCompare(b.url)),
      rawDocs,
      browserPages: [...browserPages].sort((a, b) => a.url.localeCompare(b.url))
    };
  }
}
