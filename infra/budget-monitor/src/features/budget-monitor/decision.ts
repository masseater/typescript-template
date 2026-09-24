import { Effect, Schema } from "effect";

import { fail, type BudgetConfig } from "./config.ts";

import type { UsageSnapshot } from "./billing.ts";

type BudgetDecision = {
  readonly periodStart: string;
  readonly usageUsd: number;
  readonly allowanceUsd: number;
  readonly estimatedTotalJpy: number;
  readonly jpyPerUsd: number;
  readonly level: 0 | 80 | 100;
  readonly notificationKey: string;
};

const noAlertLevel = 0;
const warningLevel = 80;
const exhaustedLevel = 100;
const warningRatio = 0.8;
const fixedCostUsd = 5;
const reserveUsd = 5;

const alertLevel = (usageRatio: number): BudgetDecision["level"] =>
  usageRatio >= 1 ? exhaustedLevel : usageRatio >= warningRatio ? warningLevel : noAlertLevel;

const evaluateBudget = Effect.fn("evaluateBudget")(function* evaluateBudget(asked: {
  readonly config: Readonly<BudgetConfig>;
  readonly jpyPerUsd: number;
  readonly snapshot: Readonly<UsageSnapshot>;
}) {
  const allowance = asked.config.BUDGET_JPY / asked.jpyPerUsd - fixedCostUsd - reserveUsd;
  if (
    !Number.isFinite(allowance) ||
    !Number.isFinite(asked.snapshot.usageUsd) ||
    asked.snapshot.usageUsd < 0
  ) {
    return yield* fail("budget_input_invalid");
  }
  if (allowance <= 0) {
    return yield* fail("budget_has_no_usage_allowance");
  }
  const level = alertLevel(asked.snapshot.usageUsd / allowance);
  return {
    allowanceUsd: allowance,
    estimatedTotalJpy: (asked.snapshot.usageUsd + fixedCostUsd) * asked.jpyPerUsd,
    jpyPerUsd: asked.jpyPerUsd,
    level,
    notificationKey: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
      asked.snapshot.periodStart,
      asked.config.BUDGET_JPY,
      fixedCostUsd,
      reserveUsd,
      level,
    ]).pipe(Effect.orDie),
    periodStart: asked.snapshot.periodStart,
    usageUsd: asked.snapshot.usageUsd,
  };
});

const shouldNotify = (
  decision: Readonly<BudgetDecision>,
  notifiedKeys: readonly string[],
): boolean => {
  return decision.level !== 0 && !notifiedKeys.includes(decision.notificationKey);
};

export { evaluateBudget, shouldNotify };
export type { BudgetDecision };
