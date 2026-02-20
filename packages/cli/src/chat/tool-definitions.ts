import type { ToolDefinition } from '../llm/llm-client';

import type { ChatConfig } from './chat-types';

export type ChatToolName =
  | 'read_folder'
  | 'read_file'
  | 'fetch_url'
  | 'generate_mcp'
  | 'run_tests'
  | 'test_integration'
  | 'publish_mcp'
  | 'show_history';

export function buildToolDefinitions(config: ChatConfig): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'read_folder',
        description: [
          'Inspect local project files for API docs and implementation clues.',
          'Use this first when the user mentions current/project directory, a folder, or gives no explicit path.',
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
          'Read the FULL content of a single file. Use this when you need the complete content of a specific file,',
          'especially after read_folder shows a preview was truncated.',
          'Always prefer this over read_folder when the user mentions a specific file name.'
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
          'Requires base_url; auth_env is optional key/value credentials.'
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
        description: 'Show recent generation sessions and last run metadata for this workspace.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    }
  ];
}
