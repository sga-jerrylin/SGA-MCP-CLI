import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';

import type { RunRecord } from './run-record';
import { SessionReader } from './session-reader';

describe('SessionReader', () => {
  it('returns null when last-run.json does not exist', () => {
    const root = mkdtempSync(join(os.tmpdir(), 'sga-project-'));
    const reader = new SessionReader();

    expect(reader.lastRun(root)).toBeNull();
  });

  it('reads RunRecord from .sga/last-run.json', () => {
    const root = mkdtempSync(join(os.tmpdir(), 'sga-project-'));
    const record: RunRecord = {
      id: '2',
      source: './demo',
      startedAt: '2026-02-19T20:00:00.000Z',
      finishedAt: '2026-02-19T20:00:01.000Z',
      status: 'failed',
      filesWritten: [],
      errorMessage: 'boom',
      durationMs: 1000
    };

    const stateDir = join(root, '.sga');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'last-run.json'), JSON.stringify(record, null, 2), 'utf8');

    const reader = new SessionReader();
    expect(reader.lastRun(root)).toEqual(record);
  });
});
