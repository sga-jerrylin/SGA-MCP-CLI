"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodegenService = void 0;
exports.parseGeneratedFiles = parseGeneratedFiles;
const prompt_builder_1 = require("./prompt-builder");
function parseGeneratedFiles(raw) {
    const chunks = raw
        .split('===FILE===')
        .map((part) => part.trim())
        .filter(Boolean);
    return chunks
        .map((chunk) => {
        const [header, ...contentLines] = chunk.split(/\r?\n/);
        if (!header) {
            return null;
        }
        return {
            path: header.trim(),
            content: contentLines.join('\n').trim()
        };
    })
        .filter((item) => item !== null);
}
class CodegenService {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    async generate(ir) {
        const prompt = (0, prompt_builder_1.buildCodegenPrompt)(ir);
        const raw = await this.llm.complete(prompt);
        return parseGeneratedFiles(raw);
    }
}
exports.CodegenService = CodegenService;
//# sourceMappingURL=codegen.service.js.map