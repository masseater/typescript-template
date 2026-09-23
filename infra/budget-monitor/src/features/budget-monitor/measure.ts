import { Clock, Effect } from "effect";

import { fetchUsage } from "./billing.ts";
import { evaluateBudget } from "./decision.ts";
import { fetchJpyPerUsd } from "./exchange-rate.ts";

import type { BudgetConfig } from "./config.ts";

const measureBudget = Effect.fn("measureBudget")(function* measureBudget(
  config: Readonly<BudgetConfig>,
) {
  const observedAt = yield* Clock.currentTimeMillis;
  const [snapshot, jpyPerUsd] = yield* Effect.all(
    [
      fetchUsage({
        accountId: config.CLOUDFLARE_ACCOUNT_ID,
        observedAt,
        token: config.BILLING_READ_TOKEN,
      }),
      fetchJpyPerUsd(observedAt),
    ],
    { concurrency: "unbounded" },
  );
  return yield* evaluateBudget({ config, jpyPerUsd, snapshot });
});

export { measureBudget };
