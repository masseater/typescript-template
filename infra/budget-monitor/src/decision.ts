import { Effect } from "effect";

import { fail, type BudgetConfig } from "./config.ts";

import type { UsageSnapshot } from "./billing.ts";

const WARNING_RATIO = 0.8;

type BudgetDecision = {
  readonly periodStart: string;
  readonly usageUsd: number;
  readonly allowanceUsd: number;
  readonly estimatedTotalJpy: number;
  readonly level: 0 | 80 | 100;
  readonly notificationKey: string;
};

const alertLevel = (ratio: number): BudgetDecision["level"] => {
  if (ratio >= 1) {
    return 100;
  }
  if (ratio >= WARNING_RATIO) {
    return 80;
  }
  return 0;
};

const decisionOf = (asked: {
  readonly snapshot: Readonly<UsageSnapshot>;
  readonly config: Readonly<BudgetConfig>;
  readonly allowanceUsd: number;
}): BudgetDecision => {
  const level = alertLevel(asked.snapshot.usageUsd / asked.allowanceUsd);
  return {
    allowanceUsd: asked.allowanceUsd,
    estimatedTotalJpy:
      (asked.snapshot.usageUsd + asked.config.FIXED_COST_USD) * asked.config.JPY_PER_USD,
    level,
    notificationKey: JSON.stringify([
      asked.snapshot.periodStart,
      asked.config.BUDGET_JPY,
      asked.config.JPY_PER_USD,
      asked.config.FIXED_COST_USD,
      asked.config.RESERVE_USD,
      level,
    ]),
    periodStart: asked.snapshot.periodStart,
    usageUsd: asked.snapshot.usageUsd,
  };
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
  return decisionOf({ allowanceUsd, config, snapshot });
});

const shouldNotify = (
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean => decision.level !== 0 && !notifiedKeys.includes(decision.notificationKey);

export { evaluateBudget, shouldNotify };
