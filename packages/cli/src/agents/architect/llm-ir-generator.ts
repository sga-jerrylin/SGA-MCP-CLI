import type { AuthType, IR, IrTool } from '@sga/core';

import type { LlmProvider } from '../../llm/llm-client';

const FALLBACK_IR: IR = {
  system: {
    code: 'unknown',
    baseUrl: 'https://api.example.com',
    authType: 'none'
  },
  tools: []
};

const VALID_METHODS = new Set<IrTool['method']>(['GET', 'POST', 'PUT', 'DELETE']);
const VALID_AUTH_TYPES = new Set<AuthType>(['none', 'bearer', 'api-key']);

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/);
  return fenced?.[1]?.trim() ?? trimmed;
}

function normalizeMethod(method: unknown): IrTool['method'] {
  const value = typeof method === 'string' ? method.toUpperCase() : '';
  if (VALID_METHODS.has(value as IrTool['method'])) {
    return value as IrTool['method'];
  }
  return 'GET';
}

function normalizeAuthType(authType: unknown): AuthType {
  const value = typeof authType === 'string' ? authType.toLowerCase() : '';
  if (VALID_AUTH_TYPES.has(value as AuthType)) {
    return value as AuthType;
  }
  return 'none';
}

function toSnakeCase(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return normalized || 'generated_tool';
}

function normalizeTools(tools: unknown): IrTool[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  const normalized: IrTool[] = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') {
      continue;
    }

    const candidate = tool as Record<string, unknown>;
    const method = normalizeMethod(candidate.method);
    const path = typeof candidate.path === 'string' && candidate.path.startsWith('/') ? candidate.path : '/';
    const name = toSnakeCase(typeof candidate.name === 'string' ? candidate.name : path);

    normalized.push({
      name,
      description:
        typeof candidate.description === 'string' && candidate.description.trim().length > 0
          ? candidate.description.trim()
          : `${method} ${path}`,
      method,
      path,
      params: [],
      needsConfirmation: false,
      isAsync: false
    });
  }

  return normalized;
}

function normalizeIr(value: unknown): IR | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    system?: {
      code?: unknown;
      baseUrl?: unknown;
      authType?: unknown;
    };
    tools?: unknown;
  };

  const code = typeof candidate.system?.code === 'string' ? candidate.system.code.trim() : '';
  const baseUrl =
    typeof candidate.system?.baseUrl === 'string' && candidate.system.baseUrl.trim().length > 0
      ? candidate.system.baseUrl.trim()
      : FALLBACK_IR.system.baseUrl;

  return {
    system: {
      code: code || FALLBACK_IR.system.code,
      baseUrl,
      authType: normalizeAuthType(candidate.system?.authType)
    },
    tools: normalizeTools(candidate.tools)
  };
}

export class LlmIrGenerator {
  public constructor(private readonly llm: Pick<LlmProvider, 'complete'>) {}

  public async generate(rawDoc: string): Promise<IR> {
    const truncated = rawDoc.slice(0, 12_000);
    const prompt = [
      'You are an API analyst that converts API documentation into MCP IR JSON.',
      'Return ONLY valid JSON without markdown fences.',
      'Use this exact schema:',
      '{',
      '  "system": {',
      '    "code": "string",',
      '    "baseUrl": "string",',
      '    "authType": "none|bearer|api-key"',
      '  },',
      '  "tools": [',
      '    {',
      '      "name": "snake_case",',
      '      "description": "string",',
      '      "method": "GET|POST|PUT|DELETE",',
      '      "path": "/path",',
      '      "params": [],',
      '      "needsConfirmation": false,',
      '      "isAsync": false',
      '    }',
      '  ]',
      '}',
      '',
      'Source documentation:',
      truncated
    ].join('\n');

    try {
      const completion = await this.llm.complete(prompt);
      const cleaned = stripMarkdownFences(completion);
      const parsed = JSON.parse(cleaned) as unknown;
      return normalizeIr(parsed) ?? FALLBACK_IR;
    } catch {
      return FALLBACK_IR;
    }
  }
}
