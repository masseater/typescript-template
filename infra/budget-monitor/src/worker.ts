import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings } from "@template/monitor";
import { parseBudgetConfig } from "./config.ts";
import { fetchUsage } from "./billing.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

interface Bindings extends MonitorBindings {
  CLOUDFLARE_ACCOUNT_ID: string;
  BILLING_READ_TOKEN: string;
  BUDGET_JPY: string;
  JPY_PER_USD: string;
  FIXED_COST_USD: string;
  RESERVE_USD: string;
}

export class BudgetMonitor extends Monitor<Bindings> {
  protected readonly event = "budget";
  protected readonly failure = {
    subject: "Cloudflare budget monitoring failed",
    text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  };

  protected async check(notify: (alert: { subject: string; text: string }) => Promise<void>) {
    const config = parseBudgetConfig(this.env);
    const snapshot = await fetchUsage(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.BILLING_READ_TOKEN,
      new Date(),
    );
    const decision = evaluateBudget(snapshot, config);
    const previous = await this.ctx.storage.get<{ period: string; keys: string[] }>(
      "notifications",
    );
    const keys = previous?.period === decision.periodStart ? previous.keys : [];
    if (shouldNotify(decision, keys)) {
      await notify({
        subject: `Cloudflare budget: ${decision.level}% threshold`,
        text: JSON.stringify(decision),
      });
      await this.ctx.storage.put("notifications", {
        period: decision.periodStart,
        keys: [...keys, decision.notificationKey],
      });
    }
    return decision;
  }
}

export default monitorHandler("budget");
