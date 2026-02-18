"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRepairLoop = runRepairLoop;
async function runRepairLoop(input) {
    const maxRounds = input.maxRounds ?? 3;
    let files = [...input.initialFiles];
    let lastResult = { passed: false, logs: [], failedTests: [] };
    for (let round = 1; round <= maxRounds; round += 1) {
        lastResult = await input.sandbox.runTests({ files, timeoutMs: input.timeoutMs });
        if (lastResult.passed) {
            return {
                passed: true,
                round,
                lastResult,
                files
            };
        }
        if (round < maxRounds) {
            files = await input.fixer.apply(lastResult.failedTests, files, lastResult.logs);
        }
    }
    return {
        passed: false,
        round: maxRounds,
        needsHuman: true,
        lastResult,
        files
    };
}
//# sourceMappingURL=repair-loop.js.map