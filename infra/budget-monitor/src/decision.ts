import type { BudgetConfig } from "./config.ts";
import type { UsageSnapshot } from "./billing.ts";

export interface BudgetDecision {
  periodStart: string;
  usageUsd: number;
  allowanceUsd: number;
  estimatedTotalJpy: number;
  level: 0 | 80 | 100;
  notificationKey: string;
}

export function evaluateBudget(snapshot: UsageSnapshot, config: BudgetConfig): BudgetDecision {
  const allowanceUsd =
    config.BUDGET_JPY / config.JPY_PER_USD - config.FIXED_COST_USD - config.RESERVE_USD;
  if (
    !Number.isFinite(allowanceUsd) ||
    allowanceUsd <= 0 ||
    !Number.isFinite(snapshot.usageUsd) ||
    snapshot.usageUsd < 0
  ) {
    throw new Error("budget_input_invalid");
  }
  const ratio = snapshot.usageUsd / allowanceUsd;
  const level = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;
  return {
    periodStart: snapshot.periodStart,
    usageUsd: snapshot.usageUsd,
    allowanceUsd,
    estimatedTotalJpy: (snapshot.usageUsd + config.FIXED_COST_USD) * config.JPY_PER_USD,
    level,
    notificationKey: JSON.stringify([
      snapshot.periodStart,
      config.BUDGET_JPY,
      config.JPY_PER_USD,
      config.FIXED_COST_USD,
      config.RESERVE_USD,
      level,
    ]),
  };
}

export function shouldNotify(decision: BudgetDecision, notifiedKeys: readonly string[]): boolean {
  return decision.level !== 0 && !notifiedKeys.includes(decision.notificationKey);
}
