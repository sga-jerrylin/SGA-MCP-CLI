import { nextDeployStatus } from './deploy-task.runner';

describe('nextDeployStatus', () => {
  it('follows happy path lifecycle', () => {
    expect(nextDeployStatus('pending', true)).toBe('pulling');
    expect(nextDeployStatus('pulling', true)).toBe('starting');
    expect(nextDeployStatus('starting', true)).toBe('verifying');
    expect(nextDeployStatus('verifying', true)).toBe('done');
  });

  it('fails on not ok', () => {
    expect(nextDeployStatus('starting', false)).toBe('failed');
  });
});
