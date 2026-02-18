"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiMcpGeneratorAdapter = void 0;
const openapi_adapter_1 = require("./openapi-adapter");
function fallbackGenerate(doc) {
    const operations = [];
    for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
        for (const [method, operation] of Object.entries(pathItem ?? {})) {
            const normalizedMethod = method.toUpperCase();
            if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
                continue;
            }
            const operationObject = operation;
            operations.push({
                name: operationObject.operationId ??
                    `${normalizedMethod.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
                description: operationObject.summary ?? `${normalizedMethod} ${path}`,
                method: normalizedMethod,
                path,
                params: []
            });
        }
    }
    return Promise.resolve(operations);
}
class OpenApiMcpGeneratorAdapter {
    upstream;
    constructor(upstream = { generate: fallbackGenerate }) {
        this.upstream = upstream;
    }
    async toIR(doc) {
        (0, openapi_adapter_1.assertOpenApiDocument)(doc);
        const operations = await this.upstream.generate(doc);
        const title = doc.info?.title ?? 'OpenAPI System';
        const tools = operations.map((operation) => ({
            name: operation.name,
            description: operation.description,
            method: operation.method,
            path: operation.path,
            needsConfirmation: false,
            isAsync: false,
            params: operation.params
        }));
        return {
            system: {
                code: (0, openapi_adapter_1.slugifySystemCode)(title),
                baseUrl: doc.servers?.[0]?.url ?? 'https://example.com',
                authType: 'none'
            },
            tools
        };
    }
}
exports.OpenApiMcpGeneratorAdapter = OpenApiMcpGeneratorAdapter;
//# sourceMappingURL=openapi-mcp-generator.adapter.js.map