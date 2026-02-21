import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import ts from 'typescript';

import type { IR } from '../ir/ir';
import { renderFromIR } from './template-renderer';

const SAMPLE_IR: IR = {
  system: {
    code: 'sga-web',
    baseUrl: 'http://43.139.167.250:8888',
    authType: 'none'
  },
  tools: [
    {
      name: 'sga_search',
      description: 'Search using SGA engine',
      method: 'GET',
      path: '/v1/agent/search',
      needsConfirmation: false,
      isAsync: false,
      params: [
        { name: 'q', type: 'string', required: true, description: 'Search query' },
        { name: 'limit', type: 'number', required: false, description: 'Max results' },
        { name: 'preset', type: 'string', required: false, description: 'Search preset' }
      ]
    }
  ]
};

function fileContent(files: Array<{ path: string; content: string }>, path: string): string {
  const found = files.find((file) => file.path === path);
  if (!found) {
    throw new Error(`Missing rendered file: ${path}`);
  }
  return found.content;
}

function compileRenderedTypescript(files: Array<{ path: string; content: string }>): string[] {
  const sandbox = mkdtempSync(join(tmpdir(), 'template-renderer-'));

  try {
    for (const file of files) {
      const fullPath = join(sandbox, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, 'utf8');
    }

    const moduleStubs = `
declare module "@modelcontextprotocol/sdk/server/index.js" {
  export class Server {
    constructor(
      info: { name: string; version: string },
      options: { capabilities: { tools: Record<string, unknown> } }
    );
    setRequestHandler(schema: unknown, handler: (request: any) => Promise<any> | any): void;
    connect(transport: unknown): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
  export class StdioServerTransport {}
}

declare module "@modelcontextprotocol/sdk/types.js" {
  export const CallToolRequestSchema: unknown;
  export const ListToolsRequestSchema: unknown;
  export interface Tool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }
}

declare module "axios" {
  export interface AxiosRequestConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    method?: string;
    url?: string;
    params?: unknown;
    data?: unknown;
  }

  export interface InternalAxiosRequestConfig extends AxiosRequestConfig {}

  export interface AxiosResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig;
  }

  export interface AxiosInstance {
    interceptors: {
      request: {
        use(
          onFulfilled: (
            config: InternalAxiosRequestConfig
          ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
        ): void;
      };
    };
    get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    request(config: AxiosRequestConfig): Promise<AxiosResponse>;
  }

  const axios: {
    create(config?: AxiosRequestConfig): AxiosInstance;
  };

  export default axios;
}

declare module "zod" {
  interface ZodValue {
    optional(): ZodValue;
    describe(_text: string): ZodValue;
    int(): ZodValue;
  }

  export const z: {
    string(): ZodValue;
    number(): ZodValue;
    boolean(): ZodValue;
    unknown(): ZodValue;
    array(inner: ZodValue): ZodValue;
    record(inner: ZodValue): ZodValue;
    object(shape: Record<string, ZodValue>): {
      parse(value: unknown): Record<string, unknown>;
    };
  };
}
`.trim();

    writeFileSync(join(sandbox, 'src', '__module-stubs__.d.ts'), `${moduleStubs}\n`, 'utf8');

    const configPath = join(sandbox, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, sandbox);
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.category === ts.DiagnosticCategory.Error);

    return diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe('renderFromIR', () => {
  it('renders all required files and excludes zod-to-json-schema dependency', () => {
    const files = renderFromIR(SAMPLE_IR);
    const paths = files.map((file) => file.path);

    expect(paths).toEqual([
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/http-client.ts',
      'src/server.ts',
      'manifest.json'
    ]);

    const packageJson = fileContent(files, 'package.json');
    expect(packageJson).toContain('"@modelcontextprotocol/sdk"');
    expect(packageJson).toContain('"type": "module"');
    expect(packageJson).not.toContain('zod-to-json-schema');

    const tsconfig = fileContent(files, 'tsconfig.json');
    expect(tsconfig).toContain('"module": "Node16"');
    expect(tsconfig).toContain('"moduleResolution": "Node16"');

    const manifest = fileContent(files, 'manifest.json');
    expect(manifest).toContain('"description": "MCP server for sga-web API"');
    expect(manifest).toContain('"toolsCount": 1');
  });

  it('renders valid empty-tool server and compiles under strict TypeScript checks', () => {
    const files = renderFromIR({
      system: {
        code: 'empty-api',
        baseUrl: 'https://example.com',
        authType: 'none'
      },
      tools: []
    });

    const serverFile = fileContent(files, 'src/server.ts');
    expect(serverFile).toContain('const tools: Tool[] = [];');

    const diagnostics = compileRenderedTypescript(files);
    expect(diagnostics).toEqual([]);
  });

  it('renders GET tool JSON schema, Zod validation, and axios params call', () => {
    const files = renderFromIR(SAMPLE_IR);
    const serverFile = fileContent(files, 'src/server.ts');

    expect(serverFile).toContain('"q": {');
    expect(serverFile).toContain('required: ["q"]');
    expect(serverFile).toContain('"q": z.string().describe("Search query"),');
    expect(serverFile).toContain('"limit": z.number().optional().describe("Max results"),');
    expect(serverFile).toContain('await client.get("/v1/agent/search", { params });');
  });

  it('renders sampleIR server that passes strict TypeScript compile checks', () => {
    const files = renderFromIR(SAMPLE_IR);
    const diagnostics = compileRenderedTypescript(files);
    expect(diagnostics).toEqual([]);
  });

  it('renders GET/POST/PUT/DELETE handlers with correct axios call patterns', () => {
    const files = renderFromIR({
      system: {
        code: 'mixed-api',
        baseUrl: 'https://api.example.com',
        authType: 'none'
      },
      tools: [
        {
          name: 'get_items',
          description: 'Get items',
          method: 'GET',
          path: '/items',
          needsConfirmation: false,
          isAsync: false,
          params: []
        },
        {
          name: 'create_item',
          description: 'Create item',
          method: 'POST',
          path: '/items',
          needsConfirmation: false,
          isAsync: false,
          params: []
        },
        {
          name: 'update_item',
          description: 'Update item',
          method: 'PUT',
          path: '/items/:id',
          needsConfirmation: false,
          isAsync: false,
          params: []
        },
        {
          name: 'delete_item',
          description: 'Delete item',
          method: 'DELETE',
          path: '/items/:id',
          needsConfirmation: false,
          isAsync: false,
          params: []
        }
      ]
    });

    const serverFile = fileContent(files, 'src/server.ts');
    expect(serverFile).toContain('await client.get("/items", { params });');
    expect(serverFile).toContain('await client.post("/items", params);');
    expect(serverFile).toContain('await client.put("/items/:id", params);');
    expect(serverFile).toContain('await client.delete("/items/:id", { data: params });');
  });

  it('renders auth interceptors for none/bearer/api-key variants', () => {
    const noneClient = fileContent(
      renderFromIR({
        ...SAMPLE_IR,
        system: { ...SAMPLE_IR.system, authType: 'none' }
      }),
      'src/http-client.ts'
    );
    const bearerClient = fileContent(
      renderFromIR({
        ...SAMPLE_IR,
        system: { ...SAMPLE_IR.system, authType: 'bearer' }
      }),
      'src/http-client.ts'
    );
    const apiKeyClient = fileContent(
      renderFromIR({
        ...SAMPLE_IR,
        system: { ...SAMPLE_IR.system, authType: 'api-key' }
      }),
      'src/http-client.ts'
    );

    expect(noneClient).not.toContain('interceptors.request.use');
    expect(bearerClient).toContain('headers.Authorization = `Bearer ${process.env.API_TOKEN}`;');
    expect(apiKeyClient).toContain('headers["X-API-Key"] = process.env.API_KEY;');
  });

  it('maps parameter types to JSON Schema and Zod calls', () => {
    const files = renderFromIR({
      system: {
        code: 'type-map',
        baseUrl: 'https://type-map.example.com',
        authType: 'none'
      },
      tools: [
        {
          name: 'map_types',
          description: 'Type mapping tool',
          method: 'POST',
          path: '/map',
          needsConfirmation: false,
          isAsync: false,
          params: [
            { name: 's', type: 'string', required: true },
            { name: 'n', type: 'number', required: true },
            { name: 'b', type: 'boolean', required: true },
            { name: 'a', type: 'array', required: false }
          ]
        }
      ]
    });

    const serverFile = fileContent(files, 'src/server.ts');
    expect(serverFile).toContain('"s": {\n          type: "string",');
    expect(serverFile).toContain('"n": {\n          type: "number",');
    expect(serverFile).toContain('"b": {\n          type: "boolean",');
    expect(serverFile).toContain('"a": {\n          type: "array",');
    expect(serverFile).toContain('"s": z.string(),');
    expect(serverFile).toContain('"n": z.number(),');
    expect(serverFile).toContain('"b": z.boolean(),');
    expect(serverFile).toContain('"a": z.array(z.unknown()).optional(),');
  });

  it('escapes special characters in descriptions safely', () => {
    const files = renderFromIR({
      system: {
        code: 'escape-api',
        baseUrl: 'https://escape.example.com',
        authType: 'none'
      },
      tools: [
        {
          name: 'escape_tool',
          description: 'Handle "quotes" and\nnew lines',
          method: 'GET',
          path: '/escape',
          needsConfirmation: false,
          isAsync: false,
          params: [
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Input "text"\nline two'
            }
          ]
        }
      ]
    });

    const serverFile = fileContent(files, 'src/server.ts');
    expect(serverFile).toContain('"Handle \\"quotes\\" and\\nnew lines"');
    expect(serverFile).toContain('"Input \\"text\\"\\nline two"');
  });
});
