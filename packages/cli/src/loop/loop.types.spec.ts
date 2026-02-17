import { createPlanStep, type ActionCall, type Observation } from './loop.types';

describe('loop types', () => {
  it('creates valid plan/action/observation structures', () => {
    const step = createPlanStep({ id: 'step-1', role: 'explorer', goal: 'scan workspace' });
    const action: ActionCall = { stepId: step.id, tool: 'fs.scan', input: { root: 'C:/repo' } };
    const observation: Observation = { stepId: step.id, ok: true, summary: 'done' };

    expect(step.role).toBe('explorer');
    expect(action.tool).toBe('fs.scan');
    expect(observation.ok).toBe(true);
  });
});
