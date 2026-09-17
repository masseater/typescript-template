import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import { DurableObject } from "cloudflare:workers";
import type { HealthMonitorConfig } from "./config.ts";
import type { HealthState } from "./decision.ts";
import type { ProbeResult } from "./probe.ts";
import { probeService } from "./probe.ts";

const ISO_DATE_LENGTH = 10;
const NOT_FOUND_STATUS = 404;

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

type AlertRoute = Readonly<Pick<HealthMonitorConfig, "ALERT_FROM">> & {
  readonly ALERT_TO: readonly string[];
};

interface CheckReport {
  readonly down: string[];
  readonly notified: number;
}

function alertSubject(down: readonly string[]): string {
  return down.length > 0
    ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
    : "Cloudflare Workers: すべてのアプリが復旧しました";
}

class HealthMonitor extends DurableObject<Bindings> {
  public override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => this.check());
  }

  private async check(): Promise<Response> {
    const config = parseHealthMonitorConfig(this.env);
    const started = Date.now();
    try {
      const report = await this.probeAll(config, started);
      await this.ctx.storage.delete("failureNotifiedDay");
      return Response.json({ ...report, ok: true });
    } catch {
      // oxlint-disable-next-line no-console
      console.error(
        JSON.stringify({ durationMs: Date.now() - started, event: "health_monitor.check_failed" }),
      );
      await this.recordFailure(config, started);
      throw new Error("health_monitor_check_failed");
    }
  }

  private async probeAll(
    config: Readonly<Omit<HealthMonitorConfig, "ALERT_TO">> & AlertRoute,
    started: number,
  ): Promise<CheckReport> {
    const results = await Promise.all(
      healthTargets(config).map(async (target) => probeService(target)),
    );
    const previous = (await this.ctx.storage.get<HealthState>("state")) ?? {};
    const decision = decideHealthAlerts(results, previous);
    const down = results.filter((result) => !result.healthy).map((result) => result.service);
    if (decision.notifications.length > 0) {
      await this.env.EMAIL.send({
        from: config.ALERT_FROM,
        subject: alertSubject(down),
        text: formatHealthMessage(decision.notifications),
        to: [...config.ALERT_TO],
      });
    }
    await this.ctx.storage.put("state", decision.state);
    const details = results.map((result: ProbeResult) => [result.service, result.detail] as const);
    // oxlint-disable-next-line no-console
    console.log(
      JSON.stringify({
        down,
        durationMs: Date.now() - started,
        event: "health_monitor.checked",
        notified: decision.notifications.length,
        services: Object.fromEntries(details),
      }),
    );
    return { down, notified: decision.notifications.length };
  }

  private async recordFailure(route: AlertRoute, started: number): Promise<void> {
    const day = new Date(started).toISOString().slice(0, ISO_DATE_LENGTH);
    const notifiedDay = await this.ctx.storage.get<string>("failureNotifiedDay");
    if (notifiedDay === day) {
      return;
    }
    await this.env.EMAIL.send({
      from: route.ALERT_FROM,
      subject: "Cloudflare Workers health monitoring failed",
      text: "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
      to: [...route.ALERT_TO],
    });
    await this.ctx.storage.put("failureNotifiedDay", day);
  }
}

export { HealthMonitor };

// oxlint-disable-next-line import/no-default-export
export default {
  fetch(): Response {
    return new Response("Not found", { status: NOT_FOUND_STATUS });
  },
  async scheduled(
    _event: unknown,
    env: { readonly MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">> },
  ): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("application-health"));
    const result = await stub.fetch("https://health.internal/check", { method: "POST" });
    if (!result.ok) {
      throw new Error("health_monitor_schedule_failed");
    }
  },
} satisfies ExportedHandler<Bindings>;
