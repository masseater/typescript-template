import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { Effect } from "effect";
import { consume, consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";

const budget = await Effect.runPromise(
  Effect.gen(function* () {
    const { settings } = yield* consumeSettings("budget-monitor", "settings");
    const tokens = yield* consume("budget-monitor", "tokens");
    return yield* deployMonitor("budget", {
      accountId: settings.accountId,
      name: `${settings.prefix}-budget`,
      artifact: budgetWorkerArtifact,
      className: "BudgetMonitor",
      token: { binding: "BILLING_READ_TOKEN", text: tokens.text("billingReadToken") },
      alert: { from: settings.mailFrom, to: settings.budget.recipients },
      variables: {
        CLOUDFLARE_ACCOUNT_ID: settings.accountId,
        BUDGET_JPY: String(settings.budget.budgetJpy),
        JPY_PER_USD: String(settings.budget.jpyPerUsd),
        FIXED_COST_USD: String(settings.budget.fixedCostUsd),
        RESERVE_USD: String(settings.budget.reserveUsd),
      },
      cron: "17 */6 * * *",
    });
  }),
);

export const workerName = budget.workerName;
export const scheduleId = budget.scheduleId;
