import { evaluateBudget, shouldNotify } from "./decision.ts";
import type { BudgetConfig } from "./config.ts";
import type { BudgetDecision } from "./decision.ts";
import { DurableObject } from "cloudflare:workers";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";

const ISO_DATE_LENGTH = 10;
const NOT_FOUND_STATUS = 404;

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  CLOUDFLARE_ACCOUNT_ID: string;
  BILLING_READ_TOKEN: string;
  BUDGET_JPY: string;
  JPY_PER_USD: string;
  FIXED_COST_USD: string;
  RESERVE_USD: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

type AlertRoute = Readonly<Pick<BudgetConfig, "ALERT_FROM">> & {
  readonly ALERT_TO: readonly string[];
};

async function evaluateCurrentUsage(
  config: Readonly<Omit<BudgetConfig, "ALERT_TO">>,
): Promise<BudgetDecision> {
  const snapshot = await fetchUsage(
    config.CLOUDFLARE_ACCOUNT_ID,
    config.BILLING_READ_TOKEN,
    new Date(),
  );
  return evaluateBudget(snapshot, config);
}

class BudgetMonitor extends DurableObject<Bindings> {
  public override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => this.check());
  }

  private async check(): Promise<Response> {
    const config = parseBudgetConfig(this.env);
    const started = Date.now();
    try {
      const decision = await evaluateCurrentUsage(config);
      await this.recordDecision(config, decision);
      console.log(
        JSON.stringify({ event: "budget.checked", ...decision, durationMs: Date.now() - started }),
      );
      return Response.json({ decision, ok: true });
    } catch {
      console.error(
        JSON.stringify({ durationMs: Date.now() - started, event: "budget.check_failed" }),
      );
      await this.recordFailure(config);
      throw new Error("budget_check_failed");
    }
  }

  private async recordDecision(
    route: AlertRoute,
    decision: Readonly<BudgetDecision>,
  ): Promise<void> {
    await this.notifyThreshold(route, decision);
    await this.recordHealthy(decision);
  }

  private async notifyThreshold(
    route: AlertRoute,
    decision: Readonly<BudgetDecision>,
  ): Promise<void> {
    const previous = await this.ctx.storage.get<{ period: string; keys: string[] }>(
      "notifications",
    );
    const keys = previous?.period === decision.periodStart ? previous.keys : [];
    if (!shouldNotify(decision, keys)) {
      return;
    }
    await this.env.EMAIL.send({
      from: route.ALERT_FROM,
      subject: `Cloudflare budget: ${decision.level}% threshold`,
      text: JSON.stringify(decision),
      to: [...route.ALERT_TO],
    });
    await this.ctx.storage.put("notifications", {
      keys: [...keys, decision.notificationKey],
      period: decision.periodStart,
    });
  }

  private async recordHealthy(decision: Readonly<BudgetDecision>): Promise<void> {
    await this.ctx.storage.put("health", { at: new Date().toISOString(), decision, ok: true });
    await this.ctx.storage.delete("failureNotifiedDay");
  }

  private async recordFailure(route: AlertRoute): Promise<void> {
    await this.ctx.storage.put("health", { at: new Date().toISOString(), ok: false });
    const day = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    const notifiedDay = await this.ctx.storage.get<string>("failureNotifiedDay");
    if (notifiedDay === day) {
      return;
    }
    await this.env.EMAIL.send({
      from: route.ALERT_FROM,
      subject: "Cloudflare budget monitoring failed",
      text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
      to: [...route.ALERT_TO],
    });
    await this.ctx.storage.put("failureNotifiedDay", day);
  }
}

export { BudgetMonitor };

export default {
  fetch(): Response {
    return new Response("Not found", { status: NOT_FOUND_STATUS });
  },
  async scheduled(_event, env): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("account-budget"));
    const result = await stub.fetch("https://budget.internal/check", { method: "POST" });
    if (!result.ok) {
      throw new Error("budget_schedule_failed");
    }
  },
} satisfies ExportedHandler<Bindings>;
