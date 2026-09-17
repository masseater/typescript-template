import { consume, consumeSettings } from "./reference.ts";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { deployMonitor } from "./worker.ts";

const { settings } = await consumeSettings("budget-monitor", "settings");
const tokens = consume("budget-monitor", "tokens");
const budget = await deployMonitor("budget", {
  accountId: settings.accountId,
  alert: { from: settings.mailFrom, to: settings.budget.recipients },
  artifact: budgetWorkerArtifact,
  className: "BudgetMonitor",
  cron: "17 */6 * * *",
  name: `${settings.prefix}-budget`,
  token: { binding: "BILLING_READ_TOKEN", text: tokens.text("billingReadToken") },
  variables: {
    BUDGET_JPY: String(settings.budget.budgetJpy),
    CLOUDFLARE_ACCOUNT_ID: settings.accountId,
    FIXED_COST_USD: String(settings.budget.fixedCostUsd),
    JPY_PER_USD: String(settings.budget.jpyPerUsd),
    RESERVE_USD: String(settings.budget.reserveUsd),
  },
});

const { scheduleId, workerName } = budget;

export { scheduleId, workerName };
