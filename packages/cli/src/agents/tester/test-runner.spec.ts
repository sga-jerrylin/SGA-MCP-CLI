import { TestRunner } from './test-runner';

describe('TestRunner', () => {
  it('runs test command in workspace', async () => {
    const exec = jest.fn().mockResolvedValue({ stdout: 'PASS' });
    const runner = new TestRunner(exec as any);

    const out = await runner.run('C:/repo', 'jest');

    expect(exec).toHaveBeenCalledWith(
      'pnpm',
      ['jest'],
      expect.objectContaining({ cwd: 'C:/repo' })
    );
    expect(out.stdout).toContain('PASS');
  });
});
