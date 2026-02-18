"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
class OpenRouterClient {
    model;
    apiKey;
    baseUrl;
    constructor(model, apiKey, baseUrl) {
        this.model = model;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async complete(prompt) {
        const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/mcp-claw',
                'X-Title': 'MCP-Claw'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 8192
            })
        });
        if (!response.ok) {
            throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
        }
        const payload = (await response.json());
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                .join('\n')
                .trim();
        }
        return '';
    }
}
exports.OpenRouterClient = OpenRouterClient;
//# sourceMappingURL=openrouter-client.js.map