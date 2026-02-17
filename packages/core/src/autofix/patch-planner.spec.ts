import { createPatchRequest } from './patch-planner';

describe('createPatchRequest', () => {
  it('returns bounded patch request from latest logs', () => {
    const logs = Array.from({ length: 30 }, (_, index) => `line-${index + 1}`);
    const request = createPatchRequest(logs, 4);
    const retainedLines = request.reason.split('\n');

    expect(request.maxFiles).toBe(4);
    expect(retainedLines).toHaveLength(20);
    expect(retainedLines[0]).toBe('line-11');
    expect(retainedLines[19]).toBe('line-30');
  });
});
