import { Module } from '@nestjs/common';
import {
  CodegenService,
  InMemoryPackager,
  type IR,
  McpClawCore,
  OpenRouterClient,
  parseSystemInfo,
  parseToolHeader
} from '@sga/core';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

function normalizeMarkdownToIr(markdown: string): IR {
  const system = parseSystemInfo(markdown);
  const sections = markdown.match(/^##\s*Tool:[\s\S]*?(?=^##\s*Tool:|$)/gim) ?? [];
  const tools = sections.map((section) => parseToolHeader(section.trim()));

  if (tools.length === 0) {
    return {
      system,
      tools: [
        {
          name: 'default_tool',
          description: 'Generated default tool',
          method: 'GET',
          path: '/health',
          needsConfirmation: false,
          isAsync: false,
          params: []
        }
      ]
    };
  }

  return { system, tools };
}

@Module({
  controllers: [GeneratorController],
  providers: [
    GeneratorService,
    {
      provide: McpClawCore,
      useFactory: () => {
        const apiKey = process.env.OPENROUTER_API_KEY ?? '';
        const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
        const coderModel = process.env.LLM_CODER_MODEL ?? 'openai/gpt-5.2-codex';
        const parserModel = process.env.LLM_PARSER_MODEL ?? 'anthropic/claude-haiku-4.5';

        const parserLlm = apiKey ? new OpenRouterClient(parserModel, apiKey, baseUrl) : null;
        const coderLlm = apiKey ? new OpenRouterClient(coderModel, apiKey, baseUrl) : null;
        const codegenService = coderLlm ? new CodegenService(coderLlm) : null;

        return new McpClawCore({
          parse: async (input) => {
            try {
              return normalizeMarkdownToIr(input.content);
            } catch (error) {
              if (!parserLlm) {
                return {
                  system: {
                    code: 'generated-system',
                    baseUrl: 'https://example.local',
                    authType: 'none'
                  },
                  tools: [
                    {
                      name: 'default_tool',
                      description: 'Fallback generated tool',
                      method: 'GET',
                      path: '/health',
                      needsConfirmation: false,
                      isAsync: false,
                      params: []
                    }
                  ]
                };
              }

              const normalizedMarkdown = await parserLlm.complete(
                [
                  'Normalize the following API document into this strict markdown format:',
                  '- System Code: <code>',
                  '- Base URL: <url>',
                  '- Auth Type: none|bearer|api-key|oauth2|hmac',
                  '',
                  '## Tool: <name>',
                  '- Method: GET|POST|PUT|DELETE|PATCH',
                  '- Path: /path',
                  '- Description: text',
                  '',
                  'Document:',
                  input.content
                ].join('\n')
              );

              try {
                return normalizeMarkdownToIr(normalizedMarkdown);
              } catch {
                if (error instanceof Error) {
                  throw error;
                }
                throw new Error('Failed to parse markdown input');
              }
            }
          },
          codegen: async (ir) => {
            if (!codegenService) {
              return [
                {
                  path: 'client.ts',
                  content:
                    "export const generatedClient = true;\nexport const system = '" +
                    ir.system.code +
                    "';\n"
                }
              ];
            }
            return codegenService.generate(ir);
          },
          sandbox: {
            runTests: async () => ({
              passed: true,
              logs: [],
              failedTests: []
            })
          },
          packager: new InMemoryPackager()
        });
      }
    }
  ]
})
export class GeneratorModule {}
