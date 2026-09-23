import { monitorWorker, type MonitorBindings } from "@repo/monitor";
import { withSpan } from "@repo/observability";
import { Effect, Schema } from "effect";

import { budgetMonitorWorker, parseBudgetConfig, type BudgetMonitorEnv } from "./config.ts";
import { shouldNotify } from "./decision.ts";
import { measureBudget } from "./measure.ts";

const budget = monitorWorker<MonitorBindings & BudgetMonitorEnv>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseBudgetConfig(env);
      const decision = yield* measureBudget(config);
      const priorNotifications = yield* Effect.promise(() =>
        ctx.storage.get<{ period: string; keys: string[] }>("notifications"),
      );
      const notificationKeys =
        priorNotifications?.period === decision.periodStart ? priorNotifications.keys : [];
      if (shouldNotify(decision, notificationKeys)) {
        yield* notify({
          subject: `Cloudflare budget: ${decision.level}% threshold`,
          text: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(decision).pipe(
            Effect.orDie,
          ),
        });
        yield* Effect.promise(() =>
          ctx.storage.put("notifications", {
            keys: [...notificationKeys, decision.notificationKey],
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
    text: "Billing data, the exchange rate, or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  },
});

class BudgetMonitor extends budget.Worker {}

export { BudgetMonitor };
export default budget.handler;
