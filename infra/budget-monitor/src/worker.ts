import { DurableObject } from "cloudflare:workers";
import { parseBudgetConfig } from "./config.ts";
import { fetchUsage } from "./billing.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

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

export class BudgetMonitor extends DurableObject<Bindings> {
  override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const config = parseBudgetConfig(this.env);
      const started = Date.now();
      try {
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
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject: `Cloudflare budget: ${decision.level}% threshold`,
            text: JSON.stringify(decision),
          });
          await this.ctx.storage.put("notifications", {
            period: decision.periodStart,
            keys: [...keys, decision.notificationKey],
          });
        }
        await this.ctx.storage.put("health", { ok: true, at: new Date().toISOString(), decision });
        await this.ctx.storage.delete("failureNotifiedDay");
        console.log(
          JSON.stringify({
            event: "budget.checked",
            ...decision,
            durationMs: Date.now() - started,
          }),
        );
        return Response.json({ ok: true, decision });
      } catch {
        console.error(
          JSON.stringify({ event: "budget.check_failed", durationMs: Date.now() - started }),
        );
        await this.ctx.storage.put("health", { ok: false, at: new Date().toISOString() });
        const day = new Date().toISOString().slice(0, 10);
        if ((await this.ctx.storage.get<string>("failureNotifiedDay")) !== day) {
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject: "Cloudflare budget monitoring failed",
            text: "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
          });
          await this.ctx.storage.put("failureNotifiedDay", day);
        }
        throw new Error("budget_check_failed");
      }
    });
  }
}

export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("account-budget"));
    const result = await stub.fetch("https://budget.internal/check", { method: "POST" });
    if (!result.ok) throw new Error("budget_schedule_failed");
  },
} satisfies ExportedHandler<Bindings>;
