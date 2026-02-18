"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPatchRequest = createPatchRequest;
function createPatchRequest(logs, maxFiles = 5) {
    return {
        reason: logs.slice(-20).join('\n'),
        maxFiles
    };
}
//# sourceMappingURL=patch-planner.js.map