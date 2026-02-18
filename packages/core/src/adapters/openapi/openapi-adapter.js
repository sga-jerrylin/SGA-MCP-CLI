"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOpenApiDocument = assertOpenApiDocument;
exports.slugifySystemCode = slugifySystemCode;
const diagnostic_error_1 = require("../../errors/diagnostic-error");
function assertOpenApiDocument(doc) {
    if (!doc || typeof doc !== 'object') {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'OPENAPI_DOCUMENT_REQUIRED',
            section: 'OpenAPI',
            hint: 'Provide a valid OpenAPI 3.x JSON/YAML document.'
        });
    }
    const paths = doc.paths;
    if (!paths || typeof paths !== 'object' || Object.keys(paths).length === 0) {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'OPENAPI_PATHS_REQUIRED',
            section: 'OpenAPI.paths',
            hint: 'OpenAPI document must include at least one path operation.'
        });
    }
}
function slugifySystemCode(input) {
    return (input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'openapi-system');
}
//# sourceMappingURL=openapi-adapter.js.map