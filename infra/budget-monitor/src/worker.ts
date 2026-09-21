import { monitorWorker, type MonitorBindings } from "@repo/monitor";
import { withSpan } from "@repo/observability";
import { Effect } from "effect";

import { billableUsageEndpoint, fetchUsage } from "./billing.ts";
import { budgetMonitorWorker, parseBudgetConfig, type BudgetMonitorEnv } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

const budget = monitorWorker<MonitorBindings & BudgetMonitorEnv>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseBudgetConfig(env);
      const snapshot = yield* fetchUsage({
        accountId: config.CLOUDFLARE_ACCOUNT_ID,
        observedAt: new Date(),
        token: config.BILLING_READ_TOKEN,
        usageEndpoint: billableUsageEndpoint(config.CLOUDFLARE_ACCOUNT_ID),
      });
      const decision = yield* evaluateBudget(snapshot, config);
      const storedNotifications = yield* Effect.promise(async () =>
        ctx.storage.get<{ period: string; keys: string[] }>("notifications"),
      );
      const notificationKeys =
        storedNotifications?.period === decision.periodStart ? storedNotifications.keys : [];
      if (shouldNotify(decision, notificationKeys)) {
        yield* notify({
          subject: `Cloudflare budget: ${decision.level}% threshold`,
          text: JSON.stringify(decision),
        });
        yield* Effect.promise(async () =>
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
    text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  },
});

class BudgetMonitor extends budget.Worker {}

export { BudgetMonitor };
export default budget.handler;
