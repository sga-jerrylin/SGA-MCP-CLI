import type { IR } from '../ir/ir';
export interface GeneratedFile {
    path: string;
    content: string;
}
export interface LlmClient {
    complete(prompt: string): Promise<string>;
}
export declare function parseGeneratedFiles(raw: string): GeneratedFile[];
export declare class CodegenService {
    private readonly llm;
    constructor(llm: LlmClient);
    generate(ir: IR): Promise<GeneratedFile[]>;
}
