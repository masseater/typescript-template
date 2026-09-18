import { Effect } from "effect";

import { fail } from "./config.ts";

import type { UsageSnapshot } from "./billing.ts";
import type { BudgetConfig } from "./config.ts";

const WARNING_LEVEL = 80;
const EXHAUSTED_LEVEL = 100;
const WARNING_RATIO = 0.8;

const NO_ALERT_LEVEL = 0;

interface BudgetDecision {
  periodStart: string;
  usageUsd: number;
  allowanceUsd: number;
  estimatedTotalJpy: number;
  level: typeof NO_ALERT_LEVEL | typeof WARNING_LEVEL | typeof EXHAUSTED_LEVEL;
  notificationKey: string;
}

const alertLevel = (ratio: number): BudgetDecision["level"] => {
  if (ratio >= 1) {
    return EXHAUSTED_LEVEL;
  }
  if (ratio >= WARNING_RATIO) {
    return WARNING_LEVEL;
  }
  return NO_ALERT_LEVEL;
};

const evaluateBudget = Effect.fn("evaluateBudget")(function* evaluateBudget(
  snapshot: Readonly<UsageSnapshot>,
  config: Readonly<BudgetConfig>,
) {
  const allowanceUsd =
    config.BUDGET_JPY / config.JPY_PER_USD - config.FIXED_COST_USD - config.RESERVE_USD;
  if (
    !Number.isFinite(allowanceUsd) ||
    allowanceUsd <= 0 ||
    !Number.isFinite(snapshot.usageUsd) ||
    snapshot.usageUsd < 0
  ) {
    return yield* fail("budget_input_invalid");
  }
  const level = alertLevel(snapshot.usageUsd / allowanceUsd);
  const decision: BudgetDecision = {
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
    periodStart: snapshot.periodStart,
    usageUsd: snapshot.usageUsd,
  };
  return decision;
});

const shouldNotify = (
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean => {
  return decision.level !== NO_ALERT_LEVEL && !notifiedKeys.includes(decision.notificationKey);
};

export { evaluateBudget, shouldNotify };
