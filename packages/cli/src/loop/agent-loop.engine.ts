import type { ActionCall, Observation, PlanStep } from './loop.types';
import { nextState, type LoopState } from './agent-loop.state-machine';

export interface AgentLoopHandlers {
  plan(): Promise<PlanStep[]>;
  act(plan: PlanStep[]): Promise<ActionCall>;
  observe(action: ActionCall): Promise<Observation>;
}

export class AgentLoopEngine {
  private state: LoopState = 'planning';

  public constructor(private readonly handlers: AgentLoopHandlers) {}

  public async run(): Promise<{
    state: LoopState;
    plan: PlanStep[];
    action: ActionCall;
    observation: Observation;
  }> {
    try {
      const plan = await this.handlers.plan();
      this.state = nextState(this.state, 'plan_done');

      const action = await this.handlers.act(plan);
      this.state = nextState(this.state, 'act_done');

      const observation = await this.handlers.observe(action);
      this.state = nextState(this.state, 'observe_done');

      return { state: this.state, plan, action, observation };
    } catch (error) {
      this.state = nextState(this.state, 'error');
      throw error;
    }
  }
}
