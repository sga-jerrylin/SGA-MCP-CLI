import type { IR } from '../ir/ir';

export function buildCodegenPrompt(ir: IR): string {
  const toolsBlock = ir.tools
    .map((tool, index) => {
      const params =
        tool.params.length === 0
          ? '  - params: none'
          : tool.params
              .map((param) => {
                const required = param.required ? 'required' : 'optional';
                const description = param.description ? `, description: ${param.description}` : '';
                return `  - param: ${param.name}, type: ${param.type}, ${required}${description}`;
              })
              .join('\n');

      return [
        `Tool #${index + 1}`,
        `- name: ${tool.name}`,
        `- method: ${tool.method}`,
        `- path: ${tool.path}`,
        `- description: ${tool.description}`,
        `- needsConfirmation: ${tool.needsConfirmation ? 'yes' : 'no'}`,
        `- isAsync: ${tool.isAsync ? 'yes' : 'no'}`,
        params
      ].join('\n');
    })
    .join('\n\n');

  return [
    'You are an expert backend code generator.',
    'Task: Generate a TypeScript Node.js MCP server package from the IR below.',
    'The package should include authentication, HTTP client logic, and tool handlers.',
    '',
    'IR',
    `- system.code: ${ir.system.code}`,
    `- system.baseUrl: ${ir.system.baseUrl}`,
    `- system.authType: ${ir.system.authType}`,
    `- tools.count: ${ir.tools.length}`,
    '',
    'Tools',
    toolsBlock || '- none',
    '',
    'STRICT OUTPUT FORMAT (MANDATORY)',
    '1) Output files only. Do not output explanations, markdown, code fences, or comments outside files.',
    '2) Every file MUST start with a line exactly equal to: ===FILE===',
    '3) The next line after ===FILE=== MUST be the relative file path.',
    '4) All following lines are file contents until the next ===FILE=== marker.',
    '5) Repeat this pattern for every file.',
    '',
    'Few-shot format example (follow this exact structure):',
    '===FILE===',
    'src/index.ts',
    "export const name = 'demo';",
    '===FILE===',
    'src/tools/list_items.ts',
    "export async function listItems() { return []; }",
    '',
    'Now generate the complete package using the same exact file-block format.'
  ].join('\n');
}
