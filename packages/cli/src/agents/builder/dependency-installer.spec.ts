import { DependencyInstaller } from './dependency-installer';

describe('DependencyInstaller', () => {
  it('detects available pm and runs install', async () => {
    const exec = jest
      .fn()
      // detectPm: pnpm --version succeeds
      .mockResolvedValueOnce({ stdout: '8.0.0' })
      // install
      .mockResolvedValueOnce({ stdout: 'ok' });
    const installer = new DependencyInstaller(exec as any);

    await installer.install('C:/repo');

    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      ['--version'],
      expect.objectContaining({ timeout: 5_000 })
    );
    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      ['install'],
      expect.objectContaining({ cwd: 'C:/repo' })
    );
  });

  it('falls back to npm when pnpm and yarn are not available', async () => {
    const exec = jest
      .fn()
      .mockRejectedValueOnce(new Error('ENOENT')) // pnpm
      .mockRejectedValueOnce(new Error('ENOENT')) // yarn
      .mockResolvedValueOnce({ stdout: '10.0.0' }) // npm
      .mockResolvedValueOnce({ stdout: 'ok' }); // install
    const installer = new DependencyInstaller(exec as any);

    await installer.install('C:/repo');

    expect(exec).toHaveBeenCalledWith(
      'npm',
      ['install'],
      expect.objectContaining({ cwd: 'C:/repo' })
    );
  });
});
