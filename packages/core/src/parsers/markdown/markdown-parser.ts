import type { AuthType, IrSystem, IrTool } from '../../ir/ir';
import { DiagnosticError } from '../../errors/diagnostic-error';

function readField(markdown: string, label: string): string {
  const match = markdown.match(new RegExp(`-\\s*${label}:\\s*(.+)$`, 'im'));
  return (match?.[1] ?? '').trim();
}

export function parseSystemInfo(markdown: string): IrSystem {
  const code = readField(markdown, 'System Code');
  const baseUrl = readField(markdown, 'Base URL');
  const authTypeText = readField(markdown, 'Auth Type').toLowerCase() as AuthType;

  if (!code) {
    throw new DiagnosticError({
      code: 'MISSING_SYSTEM_CODE',
      section: 'System Info',
      hint: 'Add `- System Code: your_system`.'
    });
  }

  if (!baseUrl) {
    throw new DiagnosticError({
      code: 'MISSING_BASE_URL',
      section: 'System Info',
      hint: 'Add `- Base URL: https://api.example.com`.'
    });
  }

  const allowed: AuthType[] = ['none', 'bearer', 'api-key', 'oauth2', 'hmac'];
  const authType = allowed.includes(authTypeText) ? authTypeText : 'none';

  return { code, baseUrl, authType };
}

export function parseToolHeader(section: string): IrTool {
  const nameMatch = section.match(/^##\s*Tool:\s*(.+)$/im);
  const name = (nameMatch?.[1] ?? '').trim();

  if (!name) {
    throw new DiagnosticError({
      code: 'MISSING_TOOL_NAME',
      section: 'Tool Header',
      hint: 'Use `## Tool: your_tool_name`.'
    });
  }

  const method = (readField(section, 'Method') || 'GET').toUpperCase();
  const path = readField(section, 'Path');
  if (!path) {
    throw new DiagnosticError({
      code: 'MISSING_TOOL_PATH',
      section: `Tool ${name}`,
      hint: 'Add `- Path: /resource`.'
    });
  }

  return {
    name,
    description: readField(section, 'Description') || `${method} ${path}`,
    method,
    path,
    needsConfirmation: /needs\s*confirmation:\s*yes/i.test(section),
    isAsync: /async:\s*yes/i.test(section),
    params: []
  };
}
