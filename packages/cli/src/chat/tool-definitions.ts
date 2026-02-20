import type { ToolDefinition } from '../llm/llm-client';

import type { ChatConfig } from './chat-types';

export type ChatToolName =
  | 'read_folder'
  | 'fetch_url'
  | 'generate_mcp'
  | 'run_tests'
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
        name: 'fetch_url',
        description: [
          'Fetch API documentation from a URL using browser rendering.',
          'Use this when user provides an http/https URL or asks to analyze online docs.'
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
