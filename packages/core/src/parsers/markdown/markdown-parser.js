"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSystemInfo = parseSystemInfo;
exports.parseToolHeader = parseToolHeader;
const diagnostic_error_1 = require("../../errors/diagnostic-error");
function readField(markdown, label) {
    const match = markdown.match(new RegExp(`-\\s*${label}:\\s*(.+)$`, 'im'));
    return (match?.[1] ?? '').trim();
}
function parseSystemInfo(markdown) {
    const code = readField(markdown, 'System Code');
    const baseUrl = readField(markdown, 'Base URL');
    const authTypeText = readField(markdown, 'Auth Type').toLowerCase();
    if (!code) {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'MISSING_SYSTEM_CODE',
            section: 'System Info',
            hint: 'Add `- System Code: your_system`.'
        });
    }
    if (!baseUrl) {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'MISSING_BASE_URL',
            section: 'System Info',
            hint: 'Add `- Base URL: https://api.example.com`.'
        });
    }
    const allowed = ['none', 'bearer', 'api-key', 'oauth2', 'hmac'];
    const authType = allowed.includes(authTypeText) ? authTypeText : 'none';
    return { code, baseUrl, authType };
}
function parseToolHeader(section) {
    const nameMatch = section.match(/^##\s*Tool:\s*(.+)$/im);
    const name = (nameMatch?.[1] ?? '').trim();
    if (!name) {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'MISSING_TOOL_NAME',
            section: 'Tool Header',
            hint: 'Use `## Tool: your_tool_name`.'
        });
    }
    const method = (readField(section, 'Method') || 'GET').toUpperCase();
    const path = readField(section, 'Path');
    if (!path) {
        throw new diagnostic_error_1.DiagnosticError({
            code: 'MISSING_TOOL_PATH',
            section: `Tool ${name}`,
            hint: 'Add `- Path: /resource`.'
        });
    }
    return {
        name,
        description: readField(section, 'Description') || `${method} ${path}`,
        method,
        path,
        needsConfirmation: /needs\s*confirmation:\s*yes/i.test(section),
        isAsync: /async:\s*yes/i.test(section),
        params: []
    };
}
//# sourceMappingURL=markdown-parser.js.map