import type { ToolDefinition } from '../llm/llm-client';

import type { ChatConfig } from './chat-types';

export type ChatToolName =
  | 'read_folder'
  | 'fetch_url'
  | 'generate_mcp'
  | 'run_tests'
  | 'show_history';

export function buildToolDefinitions(_config: ChatConfig): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'read_folder',
        description: 'Read a folder, list files, and return text content for documentation files.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Folder path to inspect'
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
        description: 'Fetch and parse web content from an API documentation URL.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Web URL to fetch'
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
        description: 'Generate an MCP server from a local path or URL source.',
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source folder path or URL'
            },
            output_dir: {
              type: 'string',
              description: 'Optional output directory'
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
        description: 'Run tests for a generated MCP server directory.',
        parameters: {
          type: 'object',
          properties: {
            dir: {
              type: 'string',
              description: 'Directory to test'
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
        name: 'show_history',
        description: 'Show recent MCP generation history from local memory sessions.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    }
  ];
}

