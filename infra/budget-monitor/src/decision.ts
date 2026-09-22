import { Effect, Schema } from "effect";

import { fail, type BudgetConfig } from "./config.ts";

import type { UsageSnapshot } from "./billing.ts";

type BudgetDecision = {
  readonly periodStart: string;
  readonly usageUsd: number;
  readonly allowanceUsd: number;
  readonly estimatedTotalJpy: number;
  readonly level: 0 | 80 | 100;
  readonly notificationKey: string;
};

const noAlertLevel = 0;
const warningLevel = 80;
const exhaustedLevel = 100;
const warningRatio = 0.8;

const allowanceUsd = (config: Readonly<BudgetConfig>): number =>
  config.BUDGET_JPY / config.JPY_PER_USD - config.FIXED_COST_USD - config.RESERVE_USD;

const alertLevel = (usageRatio: number): BudgetDecision["level"] =>
  usageRatio >= 1 ? exhaustedLevel : usageRatio >= warningRatio ? warningLevel : noAlertLevel;

const evaluateBudget = Effect.fn("evaluateBudget")(function* evaluateBudget(
  snapshot: Readonly<UsageSnapshot>,
  config: Readonly<BudgetConfig>,
) {
  const allowance = allowanceUsd(config);
  if (
    !Number.isFinite(allowance) ||
    allowance <= 0 ||
    !Number.isFinite(snapshot.usageUsd) ||
    snapshot.usageUsd < 0
  ) {
    return yield* fail("budget_input_invalid");
  }
  const level = alertLevel(snapshot.usageUsd / allowance);
  return {
    allowanceUsd: allowance,
    estimatedTotalJpy: (snapshot.usageUsd + config.FIXED_COST_USD) * config.JPY_PER_USD,
    level,
    notificationKey: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
      snapshot.periodStart,
      config.BUDGET_JPY,
      config.JPY_PER_USD,
      config.FIXED_COST_USD,
      config.RESERVE_USD,
      level,
    ]).pipe(Effect.orDie),
    periodStart: snapshot.periodStart,
    usageUsd: snapshot.usageUsd,
  };
});

const shouldNotify = (
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean => {
  return decision.level !== 0 && !notifiedKeys.includes(decision.notificationKey);
};

export { evaluateBudget, shouldNotify };
