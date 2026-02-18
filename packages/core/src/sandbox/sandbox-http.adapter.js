"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxHttpAdapter = void 0;
const sandbox_port_1 = require("./sandbox-port");
class SandboxHttpAdapter {
    baseUrl;
    fetchImpl;
    constructor(baseUrl, fetchImpl) {
        this.baseUrl = baseUrl;
        this.fetchImpl = fetchImpl;
    }
    async runTests(req) {
        const response = await (0, sandbox_port_1.withTimeout)(this.fetchImpl(`${this.baseUrl}/run-tests`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(req)
        }), req.timeoutMs, 'SANDBOX_TIMEOUT');
        if (!response.ok) {
            throw new Error(`SANDBOX_HTTP_${response.status}`);
        }
        return (await response.json());
    }
}
exports.SandboxHttpAdapter = SandboxHttpAdapter;
//# sourceMappingURL=sandbox-http.adapter.js.map