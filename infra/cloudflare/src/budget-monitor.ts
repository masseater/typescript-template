import { stackName, stackOptions } from "./stacks.ts";
import { Effect } from "effect";
import { Stack } from "alchemy";
import { accountTokenRef } from "./tokens.ts";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { monitorProgram } from "./monitor.ts";

const stack = Stack(
  stackName("budget-monitor"),
  stackOptions,
  monitorProgram("budget", {
    artifact: budgetWorkerArtifact,
    className: "BudgetMonitor",
    cron: "17 */6 * * *",
    name: "budget",
    variables: Effect.fn("budgetVariables")(function* budgetVariables(config) {
      const token = yield* accountTokenRef("BillingRead");
      return {
        BILLING_READ_TOKEN: token.value,
        BUDGET_JPY: String(config.budget.budgetJpy),
        CLOUDFLARE_ACCOUNT_ID: config.accountId,
        FIXED_COST_USD: String(config.budget.fixedCostUsd),
        JPY_PER_USD: String(config.budget.jpyPerUsd),
        RESERVE_USD: String(config.budget.reserveUsd),
      };
    }),
  }),
);

// oxlint-disable-next-line import/no-default-export
export default stack;
