import { Effect, Schema } from "effect";

import { fail } from "./config.ts";

import type { UsageSnapshot } from "./billing.ts";
import type { BudgetConfig } from "./config.ts";

const NO_ALERT_LEVEL = 0;
const WARNING_LEVEL = 80;
const EXHAUSTED_LEVEL = 100;
const WARNING_RATIO = 0.8;
const FIXED_COST_USD = 5;
const RESERVE_USD = 5;
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

interface BudgetDecision {
  periodStart: string;
  usageUsd: number;
  allowanceUsd: number;
  estimatedTotalJpy: number;
  jpyPerUsd: number;
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
  jpyPerUsd: number,
) {
  const allowanceUsd = config.BUDGET_JPY / jpyPerUsd - FIXED_COST_USD - RESERVE_USD;
  if (
    !Number.isFinite(allowanceUsd) ||
    !Number.isFinite(snapshot.usageUsd) ||
    snapshot.usageUsd < 0
  ) {
    return yield* fail("budget_input_invalid");
  }
  if (allowanceUsd <= 0) {
    return yield* fail("budget_has_no_usage_allowance");
  }
  const level = alertLevel(snapshot.usageUsd / allowanceUsd);
  const decision: BudgetDecision = {
    allowanceUsd,
    estimatedTotalJpy: (snapshot.usageUsd + FIXED_COST_USD) * jpyPerUsd,
    jpyPerUsd,
    level,
    notificationKey: yield* encodeJson([
      snapshot.periodStart,
      config.BUDGET_JPY,
      FIXED_COST_USD,
      RESERVE_USD,
      level,
    ]).pipe(Effect.orDie),
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
