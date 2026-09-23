import { monitorWorker } from "@repo/monitor";
import { Effect, Schema } from "effect";

import { budgetMonitorWorker, parseBudgetConfig, type BudgetMonitorEnv } from "./config.ts";
import { shouldNotify } from "./decision.ts";
import { measureBudget } from "./measure.ts";

import type { MonitorBindings } from "@repo/monitor";

interface Bindings extends MonitorBindings, BudgetMonitorEnv {}

const budget = monitorWorker<Bindings>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseBudgetConfig(env);
      const decision = yield* measureBudget(config);
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
    }).pipe(Effect.withSpan("BudgetMonitor.check"));
  },
  className: budgetMonitorWorker.className,
  event: budgetMonitorWorker.event,
  failure: {
    subject: "Cloudflare budget monitoring failed",
    text: "Billing data, the exchange rate, or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  },
});

const BudgetMonitor = budget.Worker;

export { BudgetMonitor };
export default budget.handler;
