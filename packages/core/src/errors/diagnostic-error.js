"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticError = void 0;
class DiagnosticError extends Error {
    meta;
    constructor(meta) {
        super(meta.code);
        this.name = 'DiagnosticError';
        this.meta = meta;
    }
}
exports.DiagnosticError = DiagnosticError;
//# sourceMappingURL=diagnostic-error.js.map