import { nextState, type LoopState } from './agent-loop.state-machine';

describe('loop state machine', () => {
  it('supports legal transitions', () => {
    let state: LoopState = 'planning';
    state = nextState(state, 'plan_done');
    state = nextState(state, 'act_done');
    state = nextState(state, 'observe_done');

    expect(state).toBe('finished');
  });

  it('rejects invalid transition', () => {
    expect(() => nextState('planning', 'act_done')).toThrow('Invalid transition');
  });
});
