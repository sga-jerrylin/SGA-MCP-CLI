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
          'List files in a local directory. Returns ONLY file names, sizes, and types — NO file content.',
          'Use this first to discover what files exist, then call read_file on each relevant file.',
          `If path is omitted, default to current working directory: ${config.workDir}.`
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `Optional folder path. Relative paths are resolved from ${config.workDir}.`
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
          'Read the FULL content of a single file. ALWAYS call this after read_folder to get actual file content.',
          'read_folder only lists file names — this tool reads the content.',
          'Call this for EVERY relevant file discovered by read_folder.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `File path. Relative paths are resolved from ${config.workDir}.`
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
          'ONLY use when the user explicitly provides a URL starting with http:// or https://.',
          'Do NOT call this for local files, folders, or paths. Use read_folder instead for anything local.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Target documentation URL'
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
          'Use this to create config files, fix generated code, or add missing files.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `Target file path. Relative paths are resolved from ${config.workDir}.`
            },
            content: {
              type: 'string',
              description: 'Full file content to write.'
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
          'Search for a pattern in files within a directory and return matching lines.',
          'Use this like grep to quickly locate endpoints, auth keys, or code symbols.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Pattern to search (case-insensitive regex).'
            },
            path: {
              type: 'string',
              description:
                'Optional root directory. Defaults to last generated directory or current project.'
            },
            glob: {
              type: 'string',
              description: 'Optional file glob, for example *.ts, *.md. Defaults to *.'
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
        description: 'Extract text content from a PDF file, useful for PDF API documentation.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `PDF file path. Relative paths are resolved from ${config.workDir}.`
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
          'Use this to test endpoint behavior or check if a URL returns an OpenAPI spec.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Target URL.'
            },
            method: {
              type: 'string',
              description: 'HTTP method. Defaults to GET.'
            },
            headers: {
              type: 'object',
              description: 'Optional request headers.',
              additionalProperties: { type: 'string' }
            },
            body: {
              type: 'string',
              description: 'Optional request body as string.'
            },
            timeout_ms: {
              type: 'number',
              description: 'Request timeout in milliseconds. Defaults to 10000.'
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
          'Crawl multiple pages of API documentation starting from a URL.',
          'Follows same-domain links, optionally filtered by a link regex pattern.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            start_url: {
              type: 'string',
              description: 'Starting documentation URL.'
            },
            max_pages: {
              type: 'number',
              description: 'Maximum pages to crawl. Default 10, max 30.'
            },
            link_pattern: {
              type: 'string',
              description: 'Optional regex to filter links to follow, for example /docs/ or /api/.'
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
          'Search the web for official API documentation by product/service name.',
          'Use when the user does not provide a docs URL.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query, for example Stripe API documentation.'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return. Defaults to 5.'
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
        description:
          'Search the web using the SGA search engine. Supports Chinese search, WeChat articles, and enriched full-text extraction. Use this when you need to find information, research APIs, or look up documentation.',
        parameters: {
          type: 'object',
          properties: {
            q: {
              type: 'string',
              description: 'Search query'
            },
            preset: {
              type: 'string',
              enum: ['chinese', 'wechat', 'general'],
              description: 'Search preset. Defaults to chinese.'
            },
            limit: {
              type: 'number',
              description: 'Result limit. Defaults to 5, max 50.'
            },
            sort: {
              type: 'string',
              enum: ['time', 'relevance'],
              description: 'Sort mode. Defaults to time.'
            },
            depth: {
              type: 'string',
              enum: ['basic', 'enriched'],
              description: 'Result depth. Defaults to basic.'
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
        description:
          'Parse an OpenAPI/Swagger specification from a URL or file path. Extracts endpoints, parameters, auth schemes, and data models in a structured format.',
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'URL (http/https) or local file path to OpenAPI JSON/YAML'
            },
            max_endpoints: {
              type: 'number',
              description: 'Maximum endpoints returned. Defaults to 100.'
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
          'Use this to install dependencies (npm install), compile code (npx tsc),',
          'run tests (npx jest), check project structure (ls, cat), fix issues, etc.',
          'You can run ANY command needed to set up, build, test, or debug the generated server.',
          'Always check the output and fix problems iteratively, just like a human developer would.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description:
                'Shell command to execute, e.g. "npm install jest --save-dev" or "npx tsc --noEmit"'
            },
            cwd: {
              type: 'string',
              description: `Working directory. Defaults to last generated project or ${config.workDir}.`
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
          'Generate MCP server code from analyzed source content.',
          'Use after enough documentation context is collected and the user confirms generation.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source folder path or URL'
            },
            output_dir: {
              type: 'string',
              description: 'Optional output directory for generated files'
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
          'Run tests against a generated MCP server project.',
          'Use this after generation or when the user asks to verify quality.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: 'Directory containing generated server code'
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
          'Build the generated MCP server, start it as a subprocess, then perform real MCP tools/list and tools/call connectivity checks.',
          'Use this after generate_mcp and run_tests.',
          'Requires base_url; auth_env is optional key/value credentials.',
          'This test validates every discovered tool. Publish only after all tools pass.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: 'Path to generated MCP server. Defaults to last generated directory.'
            },
            base_url: {
              type: 'string',
              description: 'Real upstream API base URL, for example https://api.myservice.com'
            },
            auth_env: {
              type: 'object',
              description: 'Optional credentials as env vars, for example {"MY_API_KEY":"sk-xxx"}',
              additionalProperties: { type: 'string' }
            },
            test_targets: {
              type: 'object',
              description:
                'Optional deterministic test targets. Use search_url for search-like URL params and crawl_url for scrape/crawl URL params.',
              properties: {
                search_url: {
                  type: 'string',
                  description:
                    'Target URL for search-like tools (default: http://localhost:8888/search)'
                },
                crawl_url: {
                  type: 'string',
                  description:
                    'Target URL for crawl/scrape tools; must be publicly reachable (default: https://example.com)'
                }
              },
              additionalProperties: false
            },
            tool_args: {
              type: 'object',
              description:
                'Optional per-tool fixed arguments map, e.g. {"sga_scrape":{"url":"https://example.com"}}. Use "*" as wildcard.',
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
          'Publish generated MCP package to SGA Market using manifest.json in the target directory.',
          'Use after successful integration testing.',
          'Can accept market_url/token overrides; otherwise defaults to local login config.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description:
                'Path containing generated manifest.json. Defaults to last generated directory.'
            },
            market_url: {
              type: 'string',
              description: 'Optional market URL override.'
            },
            token: {
              type: 'string',
              description: 'Optional auth token override.'
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
        description:
          'Show previous MCP SERVER GENERATION RUNS (not chat history). Use this to see: which MCPs were generated, their status (pass/fail), tool counts. Do NOT use this to find chat context — your conversation history is already in your message context.',
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
          'Record a lesson learned from fixing a bug or error.',
          'ALWAYS call this after completing an error→fix→verify cycle:',
          '  - run_command failed → you diagnosed the cause → write_file fixed it → run_command passed',
          'The pattern gets saved to .mcp-claw/patterns.md and loaded in future sessions.',
          'This is how the agent evolves and avoids repeating the same mistakes.'
        ].join(' '),
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description:
                'Short title of the problem, < 60 chars. e.g. "Missing zod dependency in generated project"'
            },
            problem: {
              type: 'string',
              description: 'What the error was. Include error message or code if helpful.'
            },
            fix: {
              type: 'string',
              description:
                'What fixed it. Be specific: which file was changed, what command was run.'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags e.g. ["typescript", "windows", "pnpm", "missing-dep"]'
            }
          },
          required: ['title', 'problem', 'fix'],
          additionalProperties: false
        }
      }
    }
  ];
}
