export type AgentRole = 'explorer' | 'architect' | 'builder' | 'tester' | 'deployer';

export interface PlanStep {
  id: string;
  role: AgentRole;
  goal: string;
}

export interface ActionCall {
  stepId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface Observation {
  stepId: string;
  ok: boolean;
  summary: string;
  artifacts?: string[];
}

export function createPlanStep(step: PlanStep): PlanStep {
  return { ...step };
}
