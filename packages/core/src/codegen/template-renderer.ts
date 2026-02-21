import type { IR, IrParam, IrTool } from '../ir/ir';

import type { GeneratedFile } from './codegen.service';

const INDENT_8 = '        ';

function toPackageName(code: string): string {
  const normalized = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'generated';
}

function toSchemaVarName(toolName: string, index: number): string {
  const base = toolName
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^([^a-zA-Z_])/, '_$1');
  const normalized = base.length > 0 ? base : `tool_${index + 1}`;
  return `${normalized}Schema`;
}

export function irTypeToJsonSchemaType(irType: string): string {
  const map: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    array: 'array',
    object: 'object'
  };

  const key = irType.toLowerCase();
  return map[key] ?? 'string';
}

export function irTypeToZodCall(irType: string): string {
  const map: Record<string, string> = {
    string: 'z.string()',
    number: 'z.number()',
    integer: 'z.number().int()',
    boolean: 'z.boolean()',
    array: 'z.array(z.unknown())',
    object: 'z.record(z.unknown())'
  };

  const key = irType.toLowerCase();
  return map[key] ?? 'z.string()';
}

function renderJsonSchemaProps(params: IrParam[]): string {
  if (params.length === 0) {
    return `${INDENT_8}// no parameters`;
  }

  return params
    .map((param) => {
      const propLines = [
        `${INDENT_8}${JSON.stringify(param.name)}: {`,
        `${INDENT_8}  type: ${JSON.stringify(irTypeToJsonSchemaType(param.type))},`
      ];

      if (param.description && param.description.trim().length > 0) {
        propLines.push(`${INDENT_8}  description: ${JSON.stringify(param.description.trim())},`);
      }

      propLines.push(`${INDENT_8}},`);
      return propLines.join('\n');
    })
    .join('\n');
}

function renderRequired(params: IrParam[]): string {
  const required = params
    .filter((param) => param.required)
    .map((param) => JSON.stringify(param.name));
  return required.length > 0 ? `      required: [${required.join(', ')}],` : '';
}

function renderZodField(param: IrParam): string {
  let field = irTypeToZodCall(param.type);
  if (!param.required) {
    field += '.optional()';
  }
  if (param.description && param.description.trim().length > 0) {
    field += `.describe(${JSON.stringify(param.description.trim())})`;
  }
  return field;
}

function renderToolHttpCall(tool: IrTool, schemaVarName: string): string {
  const method = tool.method.toUpperCase();
  const pathLiteral = JSON.stringify(tool.path);

  if (method === 'GET') {
    return [
      `      const params = ${schemaVarName}.parse(args);`,
      `      const response = await client.get(${pathLiteral}, { params });`
    ].join('\n');
  }

  if (method === 'POST') {
    return [
      `      const params = ${schemaVarName}.parse(args);`,
      `      const response = await client.post(${pathLiteral}, params);`
    ].join('\n');
  }

  if (method === 'PUT') {
    return [
      `      const params = ${schemaVarName}.parse(args);`,
      `      const response = await client.put(${pathLiteral}, params);`
    ].join('\n');
  }

  if (method === 'DELETE') {
    return [
      `      const params = ${schemaVarName}.parse(args);`,
      `      const response = await client.delete(${pathLiteral}, { data: params });`
    ].join('\n');
  }

  return [
    `      const params = ${schemaVarName}.parse(args);`,
    `      const response = await client.request({ method: ${JSON.stringify(method)}, url: ${pathLiteral}, data: params });`
  ].join('\n');
}

function renderPackageJson(ir: IR): string {
  const pkg = {
    name: `${toPackageName(ir.system.code)}-mcp-server`,
    version: '1.0.0',
    description: `MCP server for ${ir.system.code}`,
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
      axios: '^1.6.0',
      zod: '^3.22.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0'
    }
  };

  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function renderTsConfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    },
    null,
    2
  )}\n`;
}

function renderHttpClient(ir: IR): string {
  const base = [
    'import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";',
    '',
    'const client: AxiosInstance = axios.create({',
    `  baseURL: ${JSON.stringify(ir.system.baseUrl)},`,
    '  timeout: 30000,',
    '  headers: { "Content-Type": "application/json" },',
    '});',
    ''
  ];

  if (ir.system.authType === 'bearer') {
    base.push(
      'client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {',
      '  const headers = (cfg.headers ?? {}) as Record<string, string>;',
      '  if (process.env.API_TOKEN) {',
      '    headers.Authorization = `Bearer ${process.env.API_TOKEN}`;',
      '  }',
      '  cfg.headers = headers;',
      '  return cfg;',
      '});',
      ''
    );
  } else if (ir.system.authType === 'api-key') {
    base.push(
      'client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {',
      '  const headers = (cfg.headers ?? {}) as Record<string, string>;',
      '  if (process.env.API_KEY) {',
      '    headers["X-API-Key"] = process.env.API_KEY;',
      '  }',
      '  cfg.headers = headers;',
      '  return cfg;',
      '});',
      ''
    );
  }

  base.push('export { client };', '');
  return base.join('\n');
}

function renderServer(ir: IR): string {
  const schemaVarNames = ir.tools.map((tool, index) => toSchemaVarName(tool.name, index));
  const toolsArray =
    ir.tools.length === 0
      ? 'const tools: Tool[] = [];'
      : [
          'const tools: Tool[] = [',
          ...ir.tools.map((tool, index) => {
            const required = renderRequired(tool.params);
            const requiredLine = required ? `\n${required}` : '';
            return [
              '  {',
              `    name: ${JSON.stringify(tool.name)},`,
              `    description: ${JSON.stringify(tool.description)},`,
              '    inputSchema: {',
              '      type: "object" as const,',
              '      properties: {',
              renderJsonSchemaProps(tool.params),
              `      },${requiredLine}`,
              '    },',
              '  },'
            ].join('\n');
          }),
          '];'
        ].join('\n');

  const validators =
    ir.tools.length === 0
      ? '// no tools to validate'
      : ir.tools
          .map((tool, index) => {
            const fields =
              tool.params.length === 0
                ? '  // no parameters'
                : tool.params
                    .map((param) => `  ${JSON.stringify(param.name)}: ${renderZodField(param)},`)
                    .join('\n');

            return [`const ${schemaVarNames[index]} = z.object({`, fields, '});'].join('\n');
          })
          .join('\n\n');

  const handlers =
    ir.tools.length === 0
      ? '    default:\n      throw new Error(`Unknown tool: ${name}`);'
      : [
          ...ir.tools.map((tool, index) => {
            const httpCall = renderToolHttpCall(tool, schemaVarNames[index]);
            return [
              `    case ${JSON.stringify(tool.name)}: {`,
              httpCall,
              '      return response.data;',
              '    }'
            ].join('\n');
          }),
          '    default:',
          '      throw new Error(`Unknown tool: ${name}`);'
        ].join('\n');

  const lines = [
    'import { Server } from "@modelcontextprotocol/sdk/server/index.js";',
    'import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";',
    'import {',
    '  CallToolRequestSchema,',
    '  ListToolsRequestSchema,',
    '  type Tool,',
    '} from "@modelcontextprotocol/sdk/types.js";',
    'import { z } from "zod";',
    'import { client } from "./http-client.js";',
    '',
    toolsArray,
    '',
    validators,
    '',
    'async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {',
    '  switch (name) {',
    handlers,
    '  }',
    '}',
    '',
    'export async function createServer(): Promise<Server> {',
    '  const server = new Server(',
    `    { name: ${JSON.stringify(`${toPackageName(ir.system.code)}-mcp-server`)}, version: "1.0.0" },`,
    '    { capabilities: { tools: {} } }',
    '  );',
    '',
    '  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));',
    '',
    '  server.setRequestHandler(CallToolRequestSchema, async (request) => {',
    '    try {',
    '      const rawArgs = request.params.arguments;',
    '      const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)',
    '        ? (rawArgs as Record<string, unknown>)',
    '        : {};',
    '      const result = await handleToolCall(request.params.name, args);',
    '      return {',
    '        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],',
    '      };',
    '    } catch (error) {',
    '      return {',
    '        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],',
    '        isError: true,',
    '      };',
    '    }',
    '  });',
    '',
    '  return server;',
    '}',
    '',
    'export async function startServer(): Promise<void> {',
    '  const server = await createServer();',
    '  const transport = new StdioServerTransport();',
    '  await server.connect(transport);',
    `  console.error(${JSON.stringify(`${ir.system.code} MCP server started on stdio`)});`,
    '}',
    ''
  ];

  return lines.join('\n');
}

function renderManifest(ir: IR): string {
  const manifest = {
    name: `${toPackageName(ir.system.code)}-mcp-server`,
    version: '1.0.0',
    tools: ir.tools.map((tool) => ({
      name: tool.name,
      description: tool.description
    })),
    transport: 'stdio'
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function renderFromIR(ir: IR): GeneratedFile[] {
  return [
    { path: 'package.json', content: renderPackageJson(ir) },
    { path: 'tsconfig.json', content: renderTsConfig() },
    {
      path: 'src/index.ts',
      content: 'import { startServer } from "./server.js";\n\nstartServer().catch(console.error);\n'
    },
    { path: 'src/http-client.ts', content: renderHttpClient(ir) },
    { path: 'src/server.ts', content: renderServer(ir) },
    { path: 'manifest.json', content: renderManifest(ir) }
  ];
}
