import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings, Notify } from "@template/monitor";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import type { HealthState } from "./decision.ts";
import type { ProbeResult } from "./probe.ts";
import { probeService } from "./probe.ts";

interface Bindings extends MonitorBindings {
  readonly USER_ORIGIN: string;
  readonly ADMIN_ORIGIN: string;
  readonly WIKI_ORIGIN: string;
}

interface HealthCheck {
  readonly down: string[];
  readonly notified: number;
  readonly services: Record<string, string>;
}

function alertSubject(down: readonly string[]): string {
  return down.length > 0
    ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
    : "Cloudflare Workers: すべてのアプリが復旧しました";
}

class HealthMonitor extends Monitor<Bindings> {
  protected readonly event = "health_monitor";
  protected readonly failure = {
    subject: "Cloudflare Workers health monitoring failed",
    text: "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
  };

  protected async check(notify: Notify): Promise<HealthCheck> {
    const config = parseHealthMonitorConfig(this.env);
    const results = await Promise.all(
      healthTargets(config).map(async (target) => probeService(target)),
    );
    const previous = (await this.ctx.storage.get<HealthState>("state")) ?? {};
    const decision = decideHealthAlerts(results, previous);
    const down = results.filter((result) => !result.healthy).map((result) => result.service);
    if (decision.notifications.length > 0) {
      await notify({
        subject: alertSubject(down),
        text: formatHealthMessage(decision.notifications),
      });
    }
    await this.ctx.storage.put("state", decision.state);
    const details = results.map((result: ProbeResult) => [result.service, result.detail] as const);
    return {
      down,
      notified: decision.notifications.length,
      services: Object.fromEntries(details),
    };
  }
}

export { HealthMonitor };

// oxlint-disable-next-line import/no-default-export
export default monitorHandler("health_monitor");
