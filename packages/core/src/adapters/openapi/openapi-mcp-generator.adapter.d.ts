import type { IR, IrParam } from '../../ir/ir';
import { type OpenApiAdapter, type OpenApiDocument } from './openapi-adapter';
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
export declare class OpenApiMcpGeneratorAdapter implements OpenApiAdapter {
    private readonly upstream;
    constructor(upstream?: OpenApiMcpGeneratorUpstream);
    toIR(doc: unknown): Promise<IR>;
}
export {};
