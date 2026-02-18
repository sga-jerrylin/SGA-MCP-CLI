"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneIR = cloneIR;
function cloneIR(ir) {
    return {
        system: { ...ir.system },
        tools: ir.tools.map((tool) => ({ ...tool, params: [...tool.params] }))
    };
}
//# sourceMappingURL=ir.js.map