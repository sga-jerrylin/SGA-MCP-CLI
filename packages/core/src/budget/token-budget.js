"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTokenBudget = checkTokenBudget;
function checkTokenBudget(serializedTools, threshold = 8000) {
    const estimated = Math.ceil(serializedTools.length / 4);
    return {
        estimated,
        threshold,
        overBudget: estimated > threshold
    };
}
//# sourceMappingURL=token-budget.js.map