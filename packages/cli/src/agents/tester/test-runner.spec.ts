import { existsSync, readFileSync } from 'node:fs';
import { TestRunner } from './test-runner';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

function mockProjectWithJest(): void {
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { jest: '^29.0.0' } }));
}

describe('TestRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects pm and runs test command', async () => {
    mockProjectWithJest();
    const exec = jest
      .fn()
      .mockResolvedValueOnce({ stdout: '8.0.0' }) // pnpm --version
      .mockResolvedValueOnce({ stdout: 'PASS' }); // pnpm jest
    const runner = new TestRunner(exec as any);

    const out = await runner.run('C:/repo', 'jest');

    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      ['--version'],
      expect.objectContaining({ timeout: 5_000 })
    );
    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      ['jest'],
      expect.objectContaining({ cwd: 'C:/repo' })
    );
    expect(out.stdout).toContain('PASS');
  });

  it('falls back to npx when pnpm and yarn missing', async () => {
    mockProjectWithJest();
    const exec = jest
      .fn()
      .mockRejectedValueOnce(new Error('ENOENT')) // pnpm
      .mockRejectedValueOnce(new Error('ENOENT')) // yarn
      .mockResolvedValueOnce({ stdout: '10.0.0' }) // npx
      .mockResolvedValueOnce({ stdout: 'PASS' });
    const runner = new TestRunner(exec as any);

    const out = await runner.run('C:/repo');

    expect(exec).toHaveBeenCalledWith('npx', ['jest'], expect.objectContaining({ cwd: 'C:/repo' }));
    expect(out.stdout).toContain('PASS');
  });

  it('falls back to compile check when no test framework', async () => {
    // package.json exists but no jest/vitest; tsconfig.json exists
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: {} }));
    const exec = jest.fn().mockResolvedValueOnce({ stdout: '' });
    const runner = new TestRunner(exec as any);

    const out = await runner.run('C:/repo');

    expect(exec).toHaveBeenCalledWith(
      'npx',
      ['tsc', '--noEmit'],
      expect.objectContaining({ cwd: 'C:/repo' })
    );
    expect(out.stdout).toContain('Compile check PASS');
  });

  it('returns no testable files when no package.json exists', async () => {
    mockExistsSync.mockReturnValue(false);
    const exec = jest.fn();
    const runner = new TestRunner(exec as any);

    const out = await runner.run('C:/repo');

    expect(exec).not.toHaveBeenCalled();
    expect(out.stdout).toContain('No testable files found');
  });
});
