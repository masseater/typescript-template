import { Clock, Effect } from "effect";

import { fetchUsage } from "./billing.ts";
import { evaluateBudget } from "./decision.ts";
import { fetchJpyPerUsd } from "./exchange-rate.ts";

import type { BudgetConfig } from "./config.ts";

const measureBudget = Effect.fn("measureBudget")(function* measureBudget(
  config: Readonly<BudgetConfig>,
) {
  const now = yield* Clock.currentTimeMillis;
  const [snapshot, jpyPerUsd] = yield* Effect.all(
    [fetchUsage(config.CLOUDFLARE_ACCOUNT_ID, config.BILLING_READ_TOKEN, now), fetchJpyPerUsd(now)],
    { concurrency: "unbounded" },
  );
  return yield* evaluateBudget(snapshot, config, jpyPerUsd);
});

export { measureBudget };
