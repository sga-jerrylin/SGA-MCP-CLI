"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClawCore = void 0;
class McpClawCore {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async generate(input) {
        const ir = await this.deps.parse(input);
        const files = await this.deps.codegen(ir);
        const testResult = await this.deps.sandbox.runTests({
            files,
            timeoutMs: 30 * 60 * 1000
        });
        return this.deps.packager.build({ ir, files, testResult });
    }
}
exports.McpClawCore = McpClawCore;
//# sourceMappingURL=mcp-claw-core.js.map