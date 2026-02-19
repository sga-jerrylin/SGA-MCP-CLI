import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { RunRecord } from './run-record';
import { resolveGlobalSessionsDir, resolveProjectLastRunPath } from './session-writer';

export interface SessionSummary {
  file: string;
  mtime: Date;
  preview: string;
}

export class SessionReader {
  public lastRun(projectDir = process.cwd()): RunRecord | null {
    const path = resolveProjectLastRunPath(projectDir);
    if (!existsSync(path)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(path, 'utf8')) as RunRecord;
    } catch {
      return null;
    }
  }

  public listSessions(limit = 20): SessionSummary[] {
    const sessionsDir = resolveGlobalSessionsDir();
    if (!existsSync(sessionsDir)) {
      return [];
    }

    const files = readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => join(sessionsDir, file))
      .map((file) => ({
        file,
        mtime: statSync(file).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit);

    return files.map((entry) => {
      const content = readFileSync(entry.file, 'utf8');
      const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
      return {
        file: entry.file,
        mtime: entry.mtime,
        preview: firstLine
      };
    });
  }
}
