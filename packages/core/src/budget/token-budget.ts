export interface TokenBudgetResult {
  estimated: number;
  overBudget: boolean;
  threshold: number;
}

export function checkTokenBudget(serializedTools: string, threshold = 8000): TokenBudgetResult {
  const estimated = Math.ceil(serializedTools.length / 4);
  return {
    estimated,
    threshold,
    overBudget: estimated > threshold
  };
}
