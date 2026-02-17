import type { IR, IrParam, IrTool } from '../../ir/ir';
import {
  assertOpenApiDocument,
  slugifySystemCode,
  type OpenApiAdapter,
  type OpenApiDocument
} from './openapi-adapter';

interface UpstreamOperation {
  name: string;
  description: string;
  method: string;
  path: string;
  params: IrParam[];
}

interface OpenApiMcpGeneratorUpstream {
  generate(doc: OpenApiDocument): Promise<UpstreamOperation[]>;
}

function fallbackGenerate(doc: OpenApiDocument): Promise<UpstreamOperation[]> {
  const operations: UpstreamOperation[] = [];

  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      const normalizedMethod = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
        continue;
      }

      const operationObject = operation as {
        operationId?: string;
        summary?: string;
      };

      operations.push({
        name:
          operationObject.operationId ??
          `${normalizedMethod.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
        description: operationObject.summary ?? `${normalizedMethod} ${path}`,
        method: normalizedMethod,
        path,
        params: []
      });
    }
  }

  return Promise.resolve(operations);
}

export class OpenApiMcpGeneratorAdapter implements OpenApiAdapter {
  public constructor(
    private readonly upstream: OpenApiMcpGeneratorUpstream = { generate: fallbackGenerate }
  ) {}

  public async toIR(doc: unknown): Promise<IR> {
    assertOpenApiDocument(doc);

    const operations = await this.upstream.generate(doc);
    const title = doc.info?.title ?? 'OpenAPI System';

    const tools: IrTool[] = operations.map((operation) => ({
      name: operation.name,
      description: operation.description,
      method: operation.method,
      path: operation.path,
      needsConfirmation: false,
      isAsync: false,
      params: operation.params
    }));

    return {
      system: {
        code: slugifySystemCode(title),
        baseUrl: doc.servers?.[0]?.url ?? 'https://example.com',
        authType: 'none'
      },
      tools
    };
  }
}
