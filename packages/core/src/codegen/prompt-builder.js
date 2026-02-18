"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCodegenPrompt = buildCodegenPrompt;
function buildCodegenPrompt(ir) {
    return [
        `System: ${ir.system.code}`,
        `BaseURL: ${ir.system.baseUrl}`,
        `AuthType: ${ir.system.authType}`,
        `Tools: ${ir.tools.map((tool) => tool.name).join(', ')}`
    ].join('\n');
}
//# sourceMappingURL=prompt-builder.js.map