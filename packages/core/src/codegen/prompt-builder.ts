import type { IR } from '../ir/ir';

export function buildCodegenPrompt(ir: IR): string {
  return [
    `System: ${ir.system.code}`,
    `BaseURL: ${ir.system.baseUrl}`,
    `AuthType: ${ir.system.authType}`,
    `Tools: ${ir.tools.map((tool) => tool.name).join(', ')}`
  ].join('\n');
}
