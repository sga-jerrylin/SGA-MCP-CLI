jest.mock('execa', () => ({
  execa: jest.fn()
}));

import { composeDown, composeUp } from './docker.runner';

describe('docker runner', () => {
  it('runs compose up and down', async () => {
    const exec = jest.fn().mockResolvedValue({ stdout: 'ok' });

    await composeUp('docker-compose.yml', exec as any);
    await composeDown('docker-compose.yml', exec as any);

    expect(exec).toHaveBeenNthCalledWith(
      1,
      'docker',
      ['compose', '-f', 'docker-compose.yml', 'up', '-d'],
      expect.any(Object)
    );
    expect(exec).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['compose', '-f', 'docker-compose.yml', 'down'],
      expect.any(Object)
    );
  });
});
