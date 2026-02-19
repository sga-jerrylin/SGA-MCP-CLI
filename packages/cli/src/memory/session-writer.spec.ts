import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { RunRecord } from './run-record';
import { SessionWriter, resolveProjectLastRunPath } from './session-writer';

function sampleRecord(): RunRecord {
  return {
    id: '1',
    source: 'https://api.example.com',
    startedAt: '2026-02-19T21:30:00.000Z',
    finishedAt: '2026-02-19T21:30:01.000Z',
    status: 'success',
    ir: {
      system: { code: 'demo', baseUrl: 'https://api.example.com', authType: 'none' },
      toolCount: 2,
      toolNames: ['list_users', 'create_user']
    },
    filesWritten: ['server.py', 'README.md'],
    durationMs: 1000
  };
}

describe('SessionWriter', () => {
  it('writes .sga/last-run.json under project dir', () => {
    const root = mkdtempSync(join(tmpdir(), 'sga-project-'));
    const home = mkdtempSync(join(tmpdir(), 'sga-home-'));
    const previousSgaHome = process.env.SGA_HOME;
    process.env.SGA_HOME = home;

    try {
      const record = sampleRecord();
      new SessionWriter().write(record, root);

      const lastRunPath = resolveProjectLastRunPath(root);
      expect(existsSync(lastRunPath)).toBe(true);
      expect(JSON.parse(readFileSync(lastRunPath, 'utf8'))).toEqual(record);
    } finally {
      process.env.SGA_HOME = previousSgaHome;
    }
  });

  it('writes markdown session file under ~/.sga/sessions', () => {
    const root = mkdtempSync(join(tmpdir(), 'sga-project-'));
    const home = mkdtempSync(join(tmpdir(), 'sga-home-'));
    const previousSgaHome = process.env.SGA_HOME;
    process.env.SGA_HOME = home;

    try {
      new SessionWriter().write(sampleRecord(), root);

      const sessionsDir = join(home, '.sga', 'sessions');
      const files = readdirSync(sessionsDir).filter((file) => file.endsWith('.md'));

      expect(files.length).toBe(1);
      const content = readFileSync(join(sessionsDir, files[0]), 'utf8');
      expect(content).toContain('# https://api.example.com');
      expect(content).toContain('- 状态：✅ success');
      expect(content).toContain('- 工具数：2');
    } finally {
      process.env.SGA_HOME = previousSgaHome;
    }
  });
});
