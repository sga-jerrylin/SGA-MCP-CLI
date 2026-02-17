import type { IR } from '../../ir/ir';
import { DiagnosticError } from '../../errors/diagnostic-error';

export interface OpenApiDocument {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
  };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, unknown>>;
}

export interface OpenApiAdapter {
  toIR(doc: unknown): Promise<IR>;
}

export function assertOpenApiDocument(doc: unknown): asserts doc is OpenApiDocument {
  if (!doc || typeof doc !== 'object') {
    throw new DiagnosticError({
      code: 'OPENAPI_DOCUMENT_REQUIRED',
      section: 'OpenAPI',
      hint: 'Provide a valid OpenAPI 3.x JSON/YAML document.'
    });
  }

  const paths = (doc as OpenApiDocument).paths;
  if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
    throw new DiagnosticError({
      code: 'OPENAPI_PATHS_REQUIRED',
      section: 'OpenAPI.paths',
      hint: 'OpenAPI document must include at least one path operation.'
    });
  }
}

export function slugifySystemCode(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'openapi-system'
  );
}
