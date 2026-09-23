type BudgetAmounts = {
  readonly budgetJpy: number;
  readonly fixedCostUsd: number;
  readonly jpyPerUsd: number;
  readonly reserveUsd: number;
};

const usageAllowanceRemains = (budget: BudgetAmounts): boolean =>
  budget.budgetJpy / budget.jpyPerUsd > budget.fixedCostUsd + budget.reserveUsd;

export { usageAllowanceRemains };
