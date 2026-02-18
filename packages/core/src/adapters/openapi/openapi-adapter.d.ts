import type { IR } from '../../ir/ir';
export interface OpenApiDocument {
    openapi?: string;
    info?: {
        title?: string;
        version?: string;
    };
    servers?: Array<{
        url: string;
    }>;
    paths?: Record<string, Record<string, unknown>>;
}
export interface OpenApiAdapter {
    toIR(doc: unknown): Promise<IR>;
}
export declare function assertOpenApiDocument(doc: unknown): asserts doc is OpenApiDocument;
export declare function slugifySystemCode(input: string): string;
