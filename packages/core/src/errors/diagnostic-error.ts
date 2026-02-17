export interface DiagnosticMeta {
  code: string;
  section: string;
  hint?: string;
}

export class DiagnosticError extends Error {
  public readonly meta: DiagnosticMeta;

  public constructor(meta: DiagnosticMeta) {
    super(meta.code);
    this.name = 'DiagnosticError';
    this.meta = meta;
  }
}
