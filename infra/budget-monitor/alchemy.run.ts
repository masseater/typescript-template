import { accountTokenRef, monitorArtifact, monitorProgram } from "@repo/infra-cloudflare/monitor";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { budgetMonitorEnv, budgetMonitorWorker } from "@repo/monitor/workers";
import { Stack } from "alchemy";
import { Effect } from "effect";

export default Stack(
  stackName("budget-monitor"),
  stackOptions,
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
