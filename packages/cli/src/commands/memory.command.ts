import * as fs from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import type { RunRecord } from '../memory/run-record';
import { SessionReader } from '../memory/session-reader';
import { resolveGlobalSessionsDir } from '../memory/session-writer';

interface SessionDisplayItem {
  source: string;
  status: 'success' | 'failed';
  toolCount: number;
  time: string;
}

function shortDate(value: string, fallback: Date): string {
  const date = Number.isNaN(Date.parse(value)) ? fallback : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseSessionFile(file: string, preview: string, mtime: Date): SessionDisplayItem {
  const content = fs.readFileSync(file, 'utf8');
  const source = preview.replace(/^#\s*/, '').trim() || '(unknown)';
  const statusMatch = content.match(/- 状态：\s*(✅ success|❌ failed)/);
  const toolsMatch = content.match(/- 工具数：\s*(\d+)/);
  const timeMatch = content.match(/- 时间：\s*(.+)/);

  return {
    source,
    status: statusMatch?.[1] === '❌ failed' ? 'failed' : 'success',
    toolCount: Number(toolsMatch?.[1] ?? '0'),
    time: shortDate(timeMatch?.[1] ?? '', mtime)
  };
}

function statusLabel(status: 'success' | 'failed'): string {
  return status === 'success' ? chalk.green('✅ success') : chalk.red('❌ failed');
}

function showLastRun(record: RunRecord, logger: Pick<Console, 'log'>): void {
  const tools = record.ir?.toolNames.join(', ') || '(none)';
  const files = record.filesWritten.join(', ') || '(none)';

  logger.log('Last run in this project (.sga/last-run.json):');
  logger.log(`  Source:  ${record.source}`);
  logger.log(`  Status:  ${statusLabel(record.status)}`);
  logger.log(`  Tools:   ${tools}`);
  logger.log(`  Files:   ${files}`);
  logger.log(`  Time:    ${record.finishedAt} (${record.durationMs}ms)`);
}

export function clearSessions(): number {
  const sessionsDir = resolveGlobalSessionsDir();
  fs.mkdirSync(sessionsDir, { recursive: true });

  const files = fs.readdirSync(sessionsDir).filter((file) => file.endsWith('.md'));
  for (const file of files) {
    fs.unlinkSync(join(sessionsDir, file));
  }

  return files.length;
}

export function registerMemoryCommand(program: Command): void {
  const memory = program.command('memory').description('Inspect and manage SGA memory');

  memory.command('show').description('Show recent sessions').action(() => {
    const reader = new SessionReader();
    const sessions = reader.listSessions(10);

    console.log(chalk.cyan('Recent sessions (10):'));
    if (sessions.length === 0) {
      console.log(chalk.gray('  (none)'));
      return;
    }

    sessions.forEach((session, index) => {
      const item = parseSessionFile(session.file, session.preview, session.mtime);
      const source = item.source.length > 30 ? `${item.source.slice(0, 27)}...` : item.source;
      console.log(
        `  ${index + 1}. ${source.padEnd(30)}  [${statusLabel(item.status)}]  ${item.toolCount} tools  ${item.time}`
      );
    });
  });

  memory.command('last').description('Show last run for this project').action(() => {
    const record = new SessionReader().lastRun();
    if (!record) {
      console.log(chalk.yellow('No run history found in this project.'));
      return;
    }

    showLastRun(record, console);
  });

  memory.command('clear').description('Delete all global session files').action(() => {
    const removed = clearSessions();
    console.log(chalk.green(`Cleared ${removed} session file(s).`));
  });
}
