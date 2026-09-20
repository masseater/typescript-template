import { monitorWorker } from "@repo/monitor";
import { Effect } from "effect";

import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

import type { MonitorBindings } from "@repo/monitor";

interface Bindings extends MonitorBindings {
  CLOUDFLARE_ACCOUNT_ID: string;
  BILLING_READ_TOKEN: string;
  BUDGET_JPY: string;
  JPY_PER_USD: string;
  FIXED_COST_USD: string;
  RESERVE_USD: string;
}

const budget = monitorWorker<Bindings>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseBudgetConfig(env);
      const snapshot = yield* fetchUsage(
        config.CLOUDFLARE_ACCOUNT_ID,
        config.BILLING_READ_TOKEN,
        new Date(),
      );
      const decision = yield* evaluateBudget(snapshot, config);
      const previous = yield* Effect.promise(async () =>
        ctx.storage.get<{ period: string; keys: string[] }>("notifications"),
      );
      const keys = previous?.period === decision.periodStart ? previous.keys : [];
      if (shouldNotify(decision, keys)) {
        yield* notify({
          subject: `Cloudflare budget: ${decision.level}% threshold`,
          text: JSON.stringify(decision),
        });
        yield* Effect.promise(async () =>
          ctx.storage.put("notifications", {
            keys: [...keys, decision.notificationKey],
            period: decision.periodStart,
          }),
        );
      }
      return decision;
    }).pipe(Effect.withSpan("BudgetMonitor.check"));
  },
  className: "BudgetMonitor",
  event: "budget",
  failure: {
    subject: "Cloudflare budget monitoring failed",
    text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  },
});

const BudgetMonitor = budget.Worker;

export { BudgetMonitor };
export default budget.handler;
