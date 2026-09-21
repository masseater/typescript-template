import { monitorWorker, type MonitorBindings } from "@repo/monitor";
import { withSpan } from "@repo/observability";
import { Clock, Effect, Schema } from "effect";

import { fetchUsage } from "./billing.ts";
import { budgetMonitorWorker, parseBudgetConfig, type BudgetMonitorEnv } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

const budget = monitorWorker<MonitorBindings & BudgetMonitorEnv>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseBudgetConfig(env);
      const snapshot = yield* fetchUsage(
        config.CLOUDFLARE_ACCOUNT_ID,
        config.BILLING_READ_TOKEN,
        yield* Clock.currentTimeMillis,
      );
      const decision = yield* evaluateBudget(snapshot, config);
      const previous = yield* Effect.promise(() =>
        ctx.storage.get<{ period: string; keys: string[] }>("notifications"),
      );
      const keys = previous?.period === decision.periodStart ? previous.keys : [];
      if (shouldNotify(decision, keys)) {
        yield* notify({
          subject: `Cloudflare budget: ${decision.level}% threshold`,
          text: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(decision).pipe(
            Effect.orDie,
          ),
        });
        yield* Effect.promise(() =>
          ctx.storage.put("notifications", {
            keys: [...keys, decision.notificationKey],
            period: decision.periodStart,
          }),
        );
      }
      return decision;
    }).pipe(withSpan("BudgetMonitor.check"));
  },
  event: budgetMonitorWorker.event,
  failure: {
    subject: "Cloudflare budget monitoring failed",
    text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  },
});

class BudgetMonitor extends budget.Worker {}

export { BudgetMonitor };
export default budget.handler;
