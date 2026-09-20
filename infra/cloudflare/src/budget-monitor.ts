import { budgetMonitorEnv, budgetMonitorWorker } from "@repo/budget-monitor/config";
import { Stack } from "alchemy";
import { Effect } from "effect";

import { monitorArtifact } from "./artifacts.ts";
import { monitorProgram } from "./monitor.ts";
import { stackName, stackOptions } from "./stacks.ts";
import { accountTokenRef } from "./tokens.ts";

const stack = Stack(
  stackName("budget-monitor"),
  stackOptions,
  monitorProgram(budgetMonitorWorker.name, {
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
        [budgetMonitorEnv.fixedCostUsd]: String(config.budget.fixedCostUsd),
        [budgetMonitorEnv.jpyPerUsd]: String(config.budget.jpyPerUsd),
        [budgetMonitorEnv.reserveUsd]: String(config.budget.reserveUsd),
      };
    }),
  }),
);

export default stack;
