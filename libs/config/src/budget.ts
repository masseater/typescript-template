const usageAllowanceRemains = (budget: {
  readonly budgetJpy: number;
  readonly fixedCostUsd: number;
  readonly jpyPerUsd: number;
  readonly reserveUsd: number;
}): boolean => budget.budgetJpy / budget.jpyPerUsd > budget.fixedCostUsd + budget.reserveUsd;

export { usageAllowanceRemains };
