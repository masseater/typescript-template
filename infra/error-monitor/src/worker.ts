import { DurableObject } from "cloudflare:workers";
import { parseErrorMonitorConfig } from "./config.ts";
import { decideNotifications, formatMessage } from "./decision.ts";
import type { SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  CLOUDFLARE_ACCOUNT_ID: string;
  OBSERVABILITY_TOKEN: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

const lookback = 15 * 60 * 1000;

export class ErrorMonitor extends DurableObject<Bindings> {
  override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const config = parseErrorMonitorConfig(this.env);
      const now = Date.now();
      try {
        const groups = await fetchErrorGroups(
          config.CLOUDFLARE_ACCOUNT_ID,
          config.OBSERVABILITY_TOKEN,
          now - lookback,
          now,
        );
        const decision = decideNotifications(
          groups,
          (await this.ctx.storage.get<SeenFingerprints>("seen")) ?? {},
          now,
        );
        if (decision.notifications.length > 0)
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
            text: formatMessage(decision.notifications),
          });
        await this.ctx.storage.put("seen", decision.seen);
        await this.ctx.storage.delete("failureNotifiedDay");
        console.log(
          JSON.stringify({
            event: "error_monitor.checked",
            groups: groups.length,
            notified: decision.notifications.length,
            durationMs: Date.now() - now,
          }),
        );
        return Response.json({ ok: true, notified: decision.notifications.length });
      } catch {
        console.error(
          JSON.stringify({ event: "error_monitor.check_failed", durationMs: Date.now() - now }),
        );
        const day = new Date(now).toISOString().slice(0, 10);
        if ((await this.ctx.storage.get<string>("failureNotifiedDay")) !== day) {
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject: "Cloudflare Workers error monitoring failed",
            text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
          });
          await this.ctx.storage.put("failureNotifiedDay", day);
        }
        throw new Error("error_monitor_check_failed");
      }
    });
  }
}

export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("account-errors"));
    const result = await stub.fetch("https://errors.internal/check", { method: "POST" });
    if (!result.ok) throw new Error("error_monitor_schedule_failed");
  },
} satisfies ExportedHandler<Bindings>;
