import type { ToolDefinition } from '../llm/llm-client';

import type { ChatConfig } from './chat-types';

export type ChatToolName =
  | 'read_folder'
  | 'read_file'
  | 'fetch_url'
  | 'write_file'
  | 'search_files'
  | 'read_pdf'
  | 'http_request'
  | 'crawl_docs'
  | 'discover_docs'
  | 'sga_search'
  | 'parse_openapi'
  | 'run_command'
  | 'generate_mcp'
  | 'run_tests'
  | 'test_integration'
  | 'publish_mcp'
  | 'show_history'
  | 'record_learning';

export function buildToolDefinitions(config: ChatConfig): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'read_folder',
        description: [
          'List files in a local directory.',
          'Returns file names, sizes, and types only — NO file content.',
          'Call this first to discover project structure, then call read_file on each relevant file.',
          `If path is omitted, lists ${config.workDir}.`,
          'Example: read_folder({}) → lists current dir;',
          'read_folder({ path: "./src" }) → lists src/ subdirectory.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: [
                `Optional. Folder to list. Relative paths resolve from ${config.workDir}.`,
                'Example: "." | "./src" | "/absolute/path/to/project"'
              ].join(' ')
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: [
          'Read the full content of a single file.',
          'Call this AFTER read_folder — read_folder only lists names, this reads content.',
          'Call for every relevant file: README, openapi.yaml, index.ts, package.json, etc.',
          'Example: read_file({ path: "./openapi.yaml" }) reads the OpenAPI spec.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: [
                `File path. Relative paths resolve from ${config.workDir}.`,
                'Example: "README.md" | "./src/index.ts" | "/project/openapi.json"'
              ].join(' ')
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: [
          'Fetch content from a remote http/https URL.',
          'Use ONLY when the user provides a URL starting with http:// or https://.',
          'For local files and folders, use read_folder / read_file instead.',
          'Example: fetch_url({ url: "https://api.openai.com/docs" }) → returns page text.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: [
                'Full http/https URL to fetch.',
                'Example: "https://docs.stripe.com/api" | "https://api.example.com/openapi.json"'
              ].join(' ')
            }
          },
          required: ['url'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: [
          'Create or overwrite a file with the given content.',
          'Use to create config files, fix generated code, or save output.',
          'Example: write_file({ path: "./src/index.ts", content: "export const x = 1;" })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: [
                `File path to write. Relative paths resolve from ${config.workDir}.`,
                'Example: "./package.json" | "./src/tool.ts" | "/tmp/result.txt"'
              ].join(' ')
            },
            content: {
              type: 'string',
              description: 'Complete file content to write (overwrites if exists).'
            }
          },
          required: ['path', 'content'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: [
          'Search for a regex pattern across files in a directory and return matching lines.',
          'Use like grep to locate endpoints, auth keys, function definitions, or config values.',
          'Example: search_files({ pattern: "apiKey", glob: "*.ts" }) finds all apiKey usages in TS files;',
          'search_files({ pattern: "POST /api/", path: "./src" }) finds POST endpoint definitions.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: [
                'Regex pattern to search (case-insensitive).',
                'Example: "Authorization" | "export function" | "\\.env\\." | "Bearer "'
              ].join(' ')
            },
            path: {
              type: 'string',
              description: [
                'Optional root directory to search in.',
                `Defaults to ${config.workDir}.`,
                'Example: "." | "./src" | "/project/lib"'
              ].join(' ')
            },
            glob: {
              type: 'string',
              description: [
                'Optional file glob filter.',
                'Defaults to * (all files).',
                'Example: "*.ts" | "*.json" | "*.yaml" | "*.md"'
              ].join(' ')
            }
          },
          required: ['pattern'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_pdf',
        description: [
          'Extract text content from a local PDF file.',
          'Useful for PDF API documentation or spec files.',
          'Example: read_pdf({ path: "./docs/api-spec.pdf" })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: [
                `PDF file path. Relative paths resolve from ${config.workDir}.`,
                'Example: "./api-docs.pdf" | "/downloads/stripe-api.pdf"'
              ].join(' ')
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'http_request',
        description: [
          'Make an HTTP request to probe or test an API endpoint.',
          'Use to check endpoint behavior, fetch a live OpenAPI spec, or test auth.',
          'Example: http_request({ url: "https://api.example.com/openapi.json" }) → fetches OpenAPI;',
          'http_request({ url: "https://api.example.com/users", method: "GET",',
          'headers: { "Authorization": "Bearer sk-xxx" } }) → tests authenticated endpoint.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: [
                'Target URL.',
                'Example: "https://api.example.com/v1/chat" | "https://api.example.com/openapi.yaml"'
              ].join(' ')
            },
            method: {
              type: 'string',
              description: [
                'HTTP method. Defaults to GET.',
                'Example: "GET" | "POST" | "PUT" | "DELETE"'
              ].join(' ')
            },
            headers: {
              type: 'object',
              description: [
                'Optional request headers as key-value pairs.',
                'Example: { "Authorization": "Bearer sk-xxx", "Content-Type": "application/json" }'
              ].join(' '),
              additionalProperties: { type: 'string' }
            },
            body: {
              type: 'string',
              description: [
                'Optional request body as a JSON string.',
                'Example: "{\\"model\\":\\"gpt-4\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"hello\\"}]}"'
              ].join(' ')
            },
            timeout_ms: {
              type: 'number',
              description:
                'Request timeout in milliseconds. Defaults to 10000. Example: 5000 | 30000'
            }
          },
          required: ['url'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'crawl_docs',
        description: [
          'Crawl multiple pages of a documentation site starting from a URL.',
          'Follows same-domain links. Use when the user gives a docs URL that has sub-pages.',
          'Prefer this over fetch_url when you need multiple pages (endpoints list, auth, models).',
          'Example: crawl_docs({ start_url: "https://docs.example.com/api", max_pages: 10 });',
          'crawl_docs({ start_url: "https://docs.stripe.com", link_pattern: "/docs/api" }) → only follow /docs/api/* links.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            start_url: {
              type: 'string',
              description: [
                'Starting documentation URL.',
                'Example: "https://docs.example.com/api/v2" | "https://developer.openai.com/docs"'
              ].join(' ')
            },
            max_pages: {
              type: 'number',
              description: 'Max pages to crawl. Default 10, max 30. Example: 5 | 20'
            },
            link_pattern: {
              type: 'string',
              description: [
                'Optional regex to filter which links to follow.',
                'Example: "/api/" | "/reference/" | "/docs/v2"'
              ].join(' ')
            }
          },
          required: ['start_url'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'discover_docs',
        description: [
          'Search the web for official API documentation by product or service name.',
          'Use when the user has NOT provided a URL and you need to find the docs first.',
          'Example: discover_docs({ query: "Stripe API documentation" });',
          'discover_docs({ query: "飞书机器人 API 文档 openapi", max_results: 3 })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: [
                'Search query to find official docs.',
                'Example: "Stripe API documentation" | "OpenAI API reference" | "飞书开放平台 API"'
              ].join(' ')
            },
            max_results: {
              type: 'number',
              description: 'Max results to return. Defaults to 5. Example: 3 | 10'
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'sga_search',
        description: [
          'Search the web via SGA engine. Supports Chinese, WeChat articles, and full-text extraction.',
          'Use for information lookup, API research, or finding documentation.',
          'Example: sga_search({ q: "qwen3 API 文档", preset: "chinese" }) → Chinese web search;',
          'sga_search({ q: "stripe webhook tutorial", preset: "general", depth: "enriched" }) → full text;',
          'sga_search({ q: "微信支付接入", preset: "wechat" }) → WeChat articles.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            q: {
              type: 'string',
              description: [
                'Search query. Supports Chinese and English.',
                'Example: "OpenAI function calling" | "阿里云 OSS API 文档" | "stripe payment link"'
              ].join(' ')
            },
            preset: {
              type: 'string',
              enum: ['chinese', 'wechat', 'general'],
              description: [
                'Search mode. "chinese" = Chinese web (default); "wechat" = WeChat articles; "general" = global web.',
                'Example: use "chinese" for 国内 APIs, "general" for international APIs.'
              ].join(' ')
            },
            limit: {
              type: 'number',
              description: 'Max results. Defaults to 5, max 50. Example: 3 | 10'
            },
            sort: {
              type: 'string',
              enum: ['time', 'relevance'],
              description: '"time" = newest first (default); "relevance" = best match first.'
            },
            depth: {
              type: 'string',
              enum: ['basic', 'enriched'],
              description:
                '"basic" = titles + snippets (fast, default); "enriched" = full page text (slow but thorough).'
            }
          },
          required: ['q'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'parse_openapi',
        description: [
          'Parse an OpenAPI/Swagger spec from a URL or local file path.',
          'Extracts endpoints, parameters, auth schemes, and data models.',
          'Use when you have a direct link to an openapi.json/openapi.yaml file.',
          'Example: parse_openapi({ source: "https://api.example.com/openapi.json" });',
          'parse_openapi({ source: "./docs/swagger.yaml", max_endpoints: 50 })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: [
                'URL or file path to the OpenAPI JSON/YAML spec.',
                'Example: "https://api.example.com/openapi.json" | "./swagger.yaml" | "https://petstore.swagger.io/v2/swagger.json"'
              ].join(' ')
            },
            max_endpoints: {
              type: 'number',
              description: 'Max endpoints to return. Defaults to 100. Example: 20 | 200'
            }
          },
          required: ['source'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'run_command',
        description: [
          'Execute a shell command in the project directory.',
          'Use to install deps, compile, run tests, list files, or fix issues.',
          'Example: run_command({ command: "npm install" }) → install deps;',
          'run_command({ command: "npx tsc --noEmit", cwd: "./generated-server" }) → type-check;',
          'run_command({ command: "node dist/index.js --help" }) → verify binary runs.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: [
                'Shell command to run.',
                'Example: "npm install" | "npx tsc --noEmit" | "node dist/index.js" | "ls -la src/"'
              ].join(' ')
            },
            cwd: {
              type: 'string',
              description: [
                `Working directory. Defaults to last generated project dir or ${config.workDir}.`,
                'Example: "./my-mcp-server" | "/tmp/generated/weather-mcp"'
              ].join(' ')
            }
          },
          required: ['command'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'generate_mcp',
        description: [
          'Generate MCP server code from analyzed source content (folder or URL).',
          'Call AFTER collecting enough documentation context and the user confirms.',
          'Example: generate_mcp({ source: "./api-docs" }) → generate from local folder;',
          'generate_mcp({ source: "https://api.openai.com", output_dir: "/tmp/openai-mcp" }) → generate from URL.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: [
                'Source to generate from: local folder path OR remote URL.',
                'Local example: "./api-docs" | "/project/stripe-api"',
                'Remote example: "https://api.example.com" | "https://docs.example.com/api"'
              ].join(' ')
            },
            output_dir: {
              type: 'string',
              description: [
                'Optional output directory for generated files.',
                'Example: "./my-mcp-server" | "/tmp/generated/weather-mcp"'
              ].join(' ')
            }
          },
          required: ['source'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'run_tests',
        description: [
          'Run unit tests on a generated MCP server project.',
          'Call after generate_mcp or when the user asks to verify code quality.',
          'Example: run_tests({ dir: "./generated/stripe-mcp" })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: [
                'Directory of the generated MCP server.',
                'Example: "./stripe-mcp" | "/tmp/generated/weather-mcp"'
              ].join(' ')
            }
          },
          required: ['dir'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'test_integration',
        description: [
          'Build and start the generated MCP server, then run real MCP tools/list + tools/call checks.',
          'Call AFTER generate_mcp and run_tests pass. Validates each tool end-to-end.',
          'Publish only after all tools pass this test.',
          'Minimal example: test_integration({ base_url: "https://api.example.com" });',
          'Full example: test_integration({',
          '  base_url: "https://api.openai.com/v1",',
          '  auth_env: { "OPENAI_API_KEY": "sk-xxx" },',
          '  tool_args: { "chat_completion": { "model": "gpt-4o-mini" } }',
          '})'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: [
                'Path to generated MCP server. Defaults to last generated directory.',
                'Example: "./stripe-mcp" | "/tmp/generated/weather-mcp"'
              ].join(' ')
            },
            base_url: {
              type: 'string',
              description: [
                'Real upstream API base URL the generated server calls.',
                'Example: "https://api.stripe.com" | "https://api.openai.com/v1" | "https://api.weather.com"'
              ].join(' ')
            },
            auth_env: {
              type: 'object',
              description: [
                'Credentials as env vars injected into the test server process.',
                'Key = env var name (must match what the generated server reads), value = credential.',
                'Example: { "STRIPE_API_KEY": "sk_test_xxx" } | { "OPENAI_API_KEY": "sk-xxx", "ORG_ID": "org-yyy" }'
              ].join(' '),
              additionalProperties: { type: 'string' }
            },
            test_targets: {
              type: 'object',
              description: [
                'Override URLs used by the integration test runner for search-like and crawl-like tools.',
                'Example: { "search_url": "https://api.example.com/search?q=test", "crawl_url": "https://example.com" }'
              ].join(' '),
              properties: {
                search_url: {
                  type: 'string',
                  description: [
                    'URL to use when calling search-like tools (default: http://localhost:8888/search).',
                    'Example: "https://api.example.com/search?q=hello"'
                  ].join(' ')
                },
                crawl_url: {
                  type: 'string',
                  description: [
                    'Publicly reachable URL to use for crawl/scrape tools (default: https://example.com).',
                    'Example: "https://docs.stripe.com"'
                  ].join(' ')
                }
              },
              additionalProperties: false
            },
            tool_args: {
              type: 'object',
              description: [
                'Fixed arguments for specific tools during integration tests.',
                'Key = tool name (or "*" for all tools), value = object of fixed args to pass.',
                'Example: { "search": { "q": "test" }, "get_user": { "user_id": "123" } }',
                'Use when a tool requires specific params the auto-tester cannot guess.'
              ].join(' '),
              additionalProperties: {
                type: 'object',
                additionalProperties: true
              }
            }
          },
          required: ['base_url'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'publish_mcp',
        description: [
          'Publish a generated MCP package to SGA Market.',
          'Reads manifest.json from the target directory. Call after test_integration passes.',
          'Example: publish_mcp({}) → publish last generated package to default market;',
          'publish_mcp({ dir: "./stripe-mcp", market_url: "https://market.sga.dev" })'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: [
                'Directory containing manifest.json. Defaults to last generated directory.',
                'Example: "./stripe-mcp" | "/tmp/generated/weather-mcp"'
              ].join(' ')
            },
            market_url: {
              type: 'string',
              description: [
                'Optional Market URL override (default: from login config).',
                'Example: "https://market.sga.dev"'
              ].join(' ')
            },
            token: {
              type: 'string',
              description: [
                'Optional auth token override (default: from login config).',
                'Example: "eyJhbGci..." (JWT token from mcp-claw login)'
              ].join(' ')
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'show_history',
        description: [
          'Show previous MCP server generation runs with their status and tool counts.',
          'Use to review which MCPs were generated, whether they passed/failed, and how many tools they have.',
          'This is NOT chat history — your conversation is already in context.',
          'Example: show_history({}) → lists recent generation runs.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'record_learning',
        description: [
          'Save a lesson learned from an error-fix-verify cycle to .mcp-claw/patterns.md.',
          'ALWAYS call this after: run_command failed → you diagnosed → write_file fixed → run_command passed.',
          'The saved pattern is loaded in future sessions so the agent avoids the same mistake.',
          'Example: record_learning({',
          '  title: "Missing zod dependency in generated project",',
          '  problem: "run_command({ command: \\"npx tsc\\" }) failed: Cannot find module \\"zod\\"",',
          '  fix: "run_command({ command: \\"npm install zod\\" }) resolved it. Added zod to package.json dependencies.",',
          '  tags: ["typescript", "missing-dep", "zod"]',
          '})'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: [
                'Short problem title, under 60 chars.',
                'Example: "Missing zod dependency" | "CORS error on Windows" | "pnpm workspace link fails"'
              ].join(' ')
            },
            problem: {
              type: 'string',
              description: [
                'What the error was. Include the error message or the failing command output.',
                'Example: "npx tsc --noEmit failed with: Cannot find module \'zod\' at generated/src/tools.ts:3"'
              ].join(' ')
            },
            fix: {
              type: 'string',
              description: [
                'What fixed it. Be specific: file changed, command run, line added.',
                'Example: "Ran npm install zod --save in the generated dir. Added \\"zod\\": \\"^3\\" to package.json dependencies."'
              ].join(' ')
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: [
                'Optional tags for filtering and searching patterns.',
                'Example: ["typescript", "windows", "pnpm", "missing-dep"] | ["auth", "cors", "fetch"]'
              ].join(' ')
            }
          },
          required: ['title', 'problem', 'fix'],
          additionalProperties: false
        }
      }
    }
  ];
}
