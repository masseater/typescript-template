import { DurableObject } from "cloudflare:workers";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import type { HealthState } from "./decision.ts";
import { probeService } from "./probe.ts";

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  USER_ORIGIN: string;
  ADMIN_ORIGIN: string;
  WIKI_ORIGIN: string;
  ACCESS_ISSUER: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

export class HealthMonitor extends DurableObject<Bindings> {
  override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const config = parseHealthMonitorConfig(this.env);
      const started = Date.now();
      try {
        const results = await Promise.all(
          healthTargets(config).map((target) => probeService(target)),
        );
        const decision = decideHealthAlerts(
          results,
          (await this.ctx.storage.get<HealthState>("state")) ?? {},
        );
        const down = results.filter((result) => !result.healthy).map((result) => result.service);
        if (decision.notifications.length > 0)
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject:
              down.length > 0
                ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
                : "Cloudflare Workers: すべてのアプリが復旧しました",
            text: formatHealthMessage(decision.notifications),
          });
        await this.ctx.storage.put("state", decision.state);
        await this.ctx.storage.delete("failureNotifiedDay");
        console.log(
          JSON.stringify({
            event: "health_monitor.checked",
            down,
            services: Object.fromEntries(
              results.map((result) => [result.service, result.detail] as const),
            ),
            notified: decision.notifications.length,
            durationMs: Date.now() - started,
          }),
        );
        return Response.json({ ok: true, down, notified: decision.notifications.length });
      } catch {
        console.error(
          JSON.stringify({
            event: "health_monitor.check_failed",
            durationMs: Date.now() - started,
          }),
        );
        const day = new Date(started).toISOString().slice(0, 10);
        if ((await this.ctx.storage.get<string>("failureNotifiedDay")) !== day) {
          await this.env.EMAIL.send({
            from: config.ALERT_FROM,
            to: config.ALERT_TO,
            subject: "Cloudflare Workers health monitoring failed",
            text: "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
          });
          await this.ctx.storage.put("failureNotifiedDay", day);
        }
        throw new Error("health_monitor_check_failed");
      }
    });
  }
}

export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("application-health"));
    const result = await stub.fetch("https://health.internal/check", { method: "POST" });
    if (!result.ok) throw new Error("health_monitor_schedule_failed");
  },
} satisfies ExportedHandler<Bindings>;
