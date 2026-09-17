import type { BudgetConfig } from "./config.ts";
import { Effect } from "effect";
import type { UsageSnapshot } from "./billing.ts";
import { fail } from "./config.ts";

const NO_ALERT_LEVEL = 0;
const WARNING_LEVEL = 80;
const EXHAUSTED_LEVEL = 100;
const WARNING_RATIO = 0.8;

interface BudgetDecision {
  periodStart: string;
  usageUsd: number;
  allowanceUsd: number;
  estimatedTotalJpy: number;
  level: typeof NO_ALERT_LEVEL | typeof WARNING_LEVEL | typeof EXHAUSTED_LEVEL;
  notificationKey: string;
}

function alertLevel(ratio: number): BudgetDecision["level"] {
  if (ratio >= 1) {
    return EXHAUSTED_LEVEL;
  }
  if (ratio >= WARNING_RATIO) {
    return WARNING_LEVEL;
  }
  return NO_ALERT_LEVEL;
}

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

function shouldNotify(
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean {
  return decision.level !== NO_ALERT_LEVEL && !notifiedKeys.includes(decision.notificationKey);
}

export { evaluateBudget, shouldNotify };
