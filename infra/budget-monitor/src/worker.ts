import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings, Notify } from "@template/monitor";
import { evaluateBudget, shouldNotify } from "./decision.ts";
import type { BudgetDecision } from "./decision.ts";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";

interface Bindings extends MonitorBindings {
  readonly CLOUDFLARE_ACCOUNT_ID: string;
  readonly BILLING_READ_TOKEN: string;
  readonly BUDGET_JPY: string;
  readonly JPY_PER_USD: string;
  readonly FIXED_COST_USD: string;
  readonly RESERVE_USD: string;
}

class BudgetMonitor extends Monitor<Bindings> {
  protected readonly event = "budget";
  protected readonly failure = {
    subject: "Cloudflare budget monitoring failed",
    text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
  };

  protected async check(notify: Notify): Promise<BudgetDecision> {
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
        keys: [...keys, decision.notificationKey],
        period: decision.periodStart,
      });
    }
    return decision;
  }
}

export { BudgetMonitor };

// oxlint-disable-next-line import/no-default-export
export default monitorHandler("budget");
