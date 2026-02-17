import { createGenerationTask } from './generation-task.assembler';

describe('createGenerationTask', () => {
  it('builds deterministic task id and hash', () => {
    const a = createGenerationTask({ projectId: 'p1', irJson: '{"a":1}' });
    const b = createGenerationTask({ projectId: 'p1', irJson: '{"a":1}' });

    expect(a.id).toBe(b.id);
    expect(a.hash).toBe(b.hash);
    expect(a.id.startsWith('p1:')).toBe(true);
  });
});
