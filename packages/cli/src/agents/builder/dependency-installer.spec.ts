import { DependencyInstaller } from './dependency-installer';

describe('DependencyInstaller', () => {
  it('runs pnpm install in target dir', async () => {
    const exec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const installer = new DependencyInstaller(exec as any);

    await installer.install('C:/repo');

    expect(exec).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({ cwd: 'C:/repo' }));
  });
});
