export interface DiagnosticMeta {
    code: string;
    section: string;
    hint?: string;
}
export declare class DiagnosticError extends Error {
    readonly meta: DiagnosticMeta;
    constructor(meta: DiagnosticMeta);
}
