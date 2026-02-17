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

export function parseToolHeader(_section: string): IrTool {
  throw new DiagnosticError({
    code: 'TOOL_PARSER_NOT_IMPLEMENTED',
    section: 'Tools',
    hint: 'Use parseToolHeader implementation from Task 2.8.'
  });
}
