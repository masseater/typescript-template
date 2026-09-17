import { decideNotifications, formatMessage } from "./decision.ts";
import { DurableObject } from "cloudflare:workers";
import type { ErrorMonitorConfig } from "./config.ts";
import type { SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";
import { parseErrorMonitorConfig } from "./config.ts";

const ISO_DATE_LENGTH = 10;
const NOT_FOUND_STATUS = 404;
const LOOKBACK_MS = 900_000;

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  CLOUDFLARE_ACCOUNT_ID: string;
  OBSERVABILITY_TOKEN: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

type AlertRoute = Readonly<Pick<ErrorMonitorConfig, "ALERT_FROM">> & {
  readonly ALERT_TO: readonly string[];
};

class ErrorMonitor extends DurableObject<Bindings> {
  public override async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => this.check());
  }

  private async check(): Promise<Response> {
    const config = parseErrorMonitorConfig(this.env);
    const started = Date.now();
    try {
      const notified = await this.notifyErrors(config, started);
      await this.ctx.storage.delete("failureNotifiedDay");
      return Response.json({ notified, ok: true });
    } catch {
      // oxlint-disable-next-line no-console
      console.error(
        JSON.stringify({ durationMs: Date.now() - started, event: "error_monitor.check_failed" }),
      );
      await this.recordFailure(config, started);
      throw new Error("error_monitor_check_failed");
    }
  }

  private async notifyErrors(
    config: Readonly<Omit<ErrorMonitorConfig, "ALERT_TO">> & AlertRoute,
    now: number,
  ): Promise<number> {
    const groups = await fetchErrorGroups({
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      from: now - LOOKBACK_MS,
      to: now,
      token: config.OBSERVABILITY_TOKEN,
    });
    const seen = (await this.ctx.storage.get<SeenFingerprints>("seen")) ?? {};
    const decision = decideNotifications(groups, seen, now);
    if (decision.notifications.length > 0) {
      await this.env.EMAIL.send({
        from: config.ALERT_FROM,
        subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
        text: formatMessage(decision.notifications),
        to: [...config.ALERT_TO],
      });
    }
    await this.ctx.storage.put("seen", decision.seen);
    // oxlint-disable-next-line no-console
    console.log(
      JSON.stringify({
        durationMs: Date.now() - now,
        event: "error_monitor.checked",
        groups: groups.length,
        notified: decision.notifications.length,
      }),
    );
    return decision.notifications.length;
  }

  private async recordFailure(route: AlertRoute, now: number): Promise<void> {
    const day = new Date(now).toISOString().slice(0, ISO_DATE_LENGTH);
    const notifiedDay = await this.ctx.storage.get<string>("failureNotifiedDay");
    if (notifiedDay === day) {
      return;
    }
    await this.env.EMAIL.send({
      from: route.ALERT_FROM,
      subject: "Cloudflare Workers error monitoring failed",
      text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
      to: [...route.ALERT_TO],
    });
    await this.ctx.storage.put("failureNotifiedDay", day);
  }
}

export { ErrorMonitor };

// oxlint-disable-next-line import/no-default-export
export default {
  fetch(): Response {
    return new Response("Not found", { status: NOT_FOUND_STATUS });
  },
  async scheduled(
    _event: unknown,
    env: { readonly MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">> },
  ): Promise<void> {
    const stub = env.MONITOR.get(env.MONITOR.idFromName("account-errors"));
    const result = await stub.fetch("https://errors.internal/check", { method: "POST" });
    if (!result.ok) {
      throw new Error("error_monitor_schedule_failed");
    }
  },
} satisfies ExportedHandler<Bindings>;
