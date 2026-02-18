export interface TokenBudgetResult {
    estimated: number;
    overBudget: boolean;
    threshold: number;
}
export declare function checkTokenBudget(serializedTools: string, threshold?: number): TokenBudgetResult;
