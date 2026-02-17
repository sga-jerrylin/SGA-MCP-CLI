export type LoopState = 'planning' | 'acting' | 'observing' | 'finished' | 'failed';
export type LoopEvent = 'plan_done' | 'act_done' | 'observe_done' | 'error';

export function nextState(current: LoopState, event: LoopEvent): LoopState {
  if (event === 'error') {
    return 'failed';
  }
  if (current === 'planning' && event === 'plan_done') {
    return 'acting';
  }
  if (current === 'acting' && event === 'act_done') {
    return 'observing';
  }
  if (current === 'observing' && event === 'observe_done') {
    return 'finished';
  }
  throw new Error(`Invalid transition: ${current} -> ${event}`);
}
