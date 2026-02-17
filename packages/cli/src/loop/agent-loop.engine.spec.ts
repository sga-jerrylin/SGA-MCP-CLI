import { AgentLoopEngine } from './agent-loop.engine';

describe('AgentLoopEngine', () => {
  it('runs plan -> act -> observe in order', async () => {
    const events: string[] = [];

    const engine = new AgentLoopEngine({
      plan: async () => {
        events.push('plan');
        return [{ id: '1', role: 'explorer', goal: 'scan' }];
      },
      act: async () => {
        events.push('act');
        return { stepId: '1', tool: 'fs.scan', input: {} };
      },
      observe: async () => {
        events.push('observe');
        return { stepId: '1', ok: true, summary: 'done' };
      }
    });

    const result = await engine.run();

    expect(events).toEqual(['plan', 'act', 'observe']);
    expect(result.state).toBe('finished');
  });
});
