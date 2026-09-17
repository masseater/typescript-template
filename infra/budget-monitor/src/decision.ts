import type { BudgetConfig } from "./config.ts";
import type { UsageSnapshot } from "./billing.ts";

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

type BudgetAmounts = Readonly<
  Pick<BudgetConfig, "BUDGET_JPY" | "FIXED_COST_USD" | "JPY_PER_USD" | "RESERVE_USD">
>;

function alertLevel(ratio: number): BudgetDecision["level"] {
  if (ratio >= 1) {
    return EXHAUSTED_LEVEL;
  }
  if (ratio >= WARNING_RATIO) {
    return WARNING_LEVEL;
  }
  return NO_ALERT_LEVEL;
}

function evaluateBudget(snapshot: Readonly<UsageSnapshot>, config: BudgetAmounts): BudgetDecision {
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
  const level = alertLevel(snapshot.usageUsd / allowanceUsd);
  return {
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
}

function shouldNotify(
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean {
  return decision.level !== NO_ALERT_LEVEL && !notifiedKeys.includes(decision.notificationKey);
}

export { evaluateBudget, shouldNotify };
export type { BudgetDecision };
