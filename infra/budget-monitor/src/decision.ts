import { Effect } from "effect";
import type { UsageSnapshot } from "./billing.ts";
import { fail } from "./config.ts";
import type { BudgetConfig } from "./config.ts";

export interface BudgetDecision {
  periodStart: string;
  usageUsd: number;
  allowanceUsd: number;
  estimatedTotalJpy: number;
  level: 0 | 80 | 100;
  notificationKey: string;
}

export const evaluateBudget = Effect.fn("evaluateBudget")(function* (
  snapshot: UsageSnapshot,
  config: BudgetConfig,
) {
  const allowanceUsd =
    config.BUDGET_JPY / config.JPY_PER_USD - config.FIXED_COST_USD - config.RESERVE_USD;
  if (
    !Number.isFinite(allowanceUsd) ||
    allowanceUsd <= 0 ||
    !Number.isFinite(snapshot.usageUsd) ||
    snapshot.usageUsd < 0
  )
    return yield* fail("budget_input_invalid");
  const ratio = snapshot.usageUsd / allowanceUsd;
  const level = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;
  const decision: BudgetDecision = {
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
  return decision;
});

export function shouldNotify(decision: BudgetDecision, notifiedKeys: readonly string[]): boolean {
  return decision.level !== 0 && !notifiedKeys.includes(decision.notificationKey);
}
