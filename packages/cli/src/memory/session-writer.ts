import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { RunRecord } from './run-record';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toSlug(source: string): string {
  const normalized = source
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (!normalized) {
    return 'run';
  }

  return normalized.slice(0, 40);
}

function formatSessionFileName(record: RunRecord): string {
  const date = new Date(record.startedAt);
  const datePart = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  const timePart = [pad(date.getHours()), pad(date.getMinutes())].join('-');

  return `${datePart}-${timePart}-${toSlug(record.source)}.md`;
}

function formatSessionMarkdown(record: RunRecord): string {
  const status = record.status === 'success' ? '✅ success' : '❌ failed';
  const toolCount = record.ir?.toolCount ?? 0;
  const toolNames = record.ir?.toolNames.join(', ') || '(none)';
  const files = record.filesWritten.length > 0 ? record.filesWritten.join(', ') : '(none)';

  const lines = [
    `# ${record.source}`,
    `- 时间：${record.startedAt}`,
    `- 状态：${status}`,
    `- 工具数：${toolCount}`,
    `- 工具列表：${toolNames}`,
    `- 生成文件：${files}`,
    `- 耗时：${record.durationMs}ms`
  ];

  if (record.errorMessage) {
    lines.push(`- 错误：${record.errorMessage}`);
  }

  return `${lines.join('\n')}\n`;
}

export function resolveProjectStateDir(projectDir = process.cwd()): string {
  return join(projectDir, '.sga');
}

export function resolveProjectLastRunPath(projectDir = process.cwd()): string {
  return join(resolveProjectStateDir(projectDir), 'last-run.json');
}

function resolveHomeDir(): string {
  return process.env.SGA_HOME || homedir();
}

export function resolveGlobalSessionsDir(home = resolveHomeDir()): string {
  return join(home, '.sga', 'sessions');
}

export class SessionWriter {
  public write(record: RunRecord, projectDir = process.cwd()): void {
    const projectStateDir = resolveProjectStateDir(projectDir);
    mkdirSync(projectStateDir, { recursive: true });
    writeFileSync(resolveProjectLastRunPath(projectDir), JSON.stringify(record, null, 2), 'utf8');

    const sessionsDir = resolveGlobalSessionsDir();
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, formatSessionFileName(record)), formatSessionMarkdown(record), 'utf8');
  }
}
