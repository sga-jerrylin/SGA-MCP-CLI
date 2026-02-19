import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

const mockListSessions = jest.fn();
const mockLastRun = jest.fn();

jest.mock('../memory/session-reader', () => ({
  SessionReader: jest.fn().mockImplementation(() => ({
    listSessions: mockListSessions,
    lastRun: mockLastRun
  }))
}));

import { registerMemoryCommand } from './memory.command';

describe('memory command', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockListSessions.mockReset();
    mockLastRun.mockReset();
  });

  it('supports show and last without crashing', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'sga-memory-'));
    const sessionFile = join(root, 'session.md');
    fs.writeFileSync(
      sessionFile,
      [
        '# https://api.stripe.com',
        '- 时间：2026-02-19T21:30:00.000Z',
        '- 状态：✅ success',
        '- 工具数：8'
      ].join('\n'),
      'utf8'
    );

    mockListSessions.mockReturnValue([
      {
        file: sessionFile,
        mtime: new Date('2026-02-19T21:30:00.000Z'),
        preview: '# https://api.stripe.com'
      }
    ]);

    mockLastRun.mockReturnValue({
      id: '1',
      source: 'https://api.stripe.com',
      startedAt: '2026-02-19T21:30:00.000Z',
      finishedAt: '2026-02-19T21:30:01.000Z',
      status: 'success',
      filesWritten: ['server.py'],
      durationMs: 1000,
      ir: {
        system: { code: 'stripe', baseUrl: 'https://api.stripe.com', authType: 'bearer' },
        toolCount: 1,
        toolNames: ['list_charges']
      }
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const program = new Command();
    registerMemoryCommand(program);

    await program.parseAsync(['node', 'sga', 'memory', 'show']);
    await program.parseAsync(['node', 'sga', 'memory', 'last']);

    expect(mockListSessions).toHaveBeenCalledWith(10);
    expect(mockLastRun).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('clear removes markdown files from session directory', async () => {
    const home = fs.mkdtempSync(join(tmpdir(), 'sga-home-'));
    const sessionsDir = join(home, '.sga', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(join(sessionsDir, 'a.md'), '# A', 'utf8');
    fs.writeFileSync(join(sessionsDir, 'b.md'), '# B', 'utf8');
    fs.writeFileSync(join(sessionsDir, 'keep.txt'), 'x', 'utf8');

    const previousSgaHome = process.env.SGA_HOME;
    process.env.SGA_HOME = home;

    try {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);

      const program = new Command();
      registerMemoryCommand(program);
      await program.parseAsync(['node', 'sga', 'memory', 'clear']);

      expect(fs.existsSync(join(sessionsDir, 'a.md'))).toBe(false);
      expect(fs.existsSync(join(sessionsDir, 'b.md'))).toBe(false);
      expect(fs.existsSync(join(sessionsDir, 'keep.txt'))).toBe(true);
    } finally {
      process.env.SGA_HOME = previousSgaHome;
    }
  });
});
