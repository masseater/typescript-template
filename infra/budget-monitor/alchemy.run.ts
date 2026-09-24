import { accountTokenRef, monitorArtifact, monitorProgram } from "@repo/infra-cloudflare/monitor";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";
import { budgetMonitorEnv, budgetMonitorWorker } from "@repo/monitor/workers";
import { Effect } from "effect";

export default prefixedStack(
  "budget-monitor",
  monitorProgram("budget", {
    artifact: monitorArtifact("budget-monitor"),
    className: budgetMonitorWorker.className,
    cron: budgetMonitorWorker.cron,
    name: budgetMonitorWorker.name,
    variables: Effect.fn("budgetVariables")(function* budgetVariables(config) {
      const token = yield* accountTokenRef("BillingRead");
      return {
        [budgetMonitorEnv.billingReadToken]: token.value,
        [budgetMonitorEnv.budgetJpy]: String(config.budget.budgetJpy),
        [budgetMonitorEnv.accountId]: config.accountId,
      };
    }),
  }),
);
