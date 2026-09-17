import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings } from "@template/monitor";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import type { HealthState } from "./decision.ts";
import { probeService } from "./probe.ts";

interface Bindings extends MonitorBindings {
  USER_ORIGIN: string;
  ADMIN_ORIGIN: string;
  WIKI_ORIGIN: string;
}

export class HealthMonitor extends Monitor<Bindings> {
  protected readonly event = "health_monitor";
  protected readonly failure = {
    subject: "Cloudflare Workers health monitoring failed",
    text: "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
  };

  protected async check(notify: (alert: { subject: string; text: string }) => Promise<void>) {
    const config = parseHealthMonitorConfig(this.env);
    const results = await Promise.all(healthTargets(config).map((target) => probeService(target)));
    const decision = decideHealthAlerts(
      results,
      (await this.ctx.storage.get<HealthState>("state")) ?? {},
    );
    const down = results.filter((result) => !result.healthy).map((result) => result.service);
    if (decision.notifications.length > 0)
      await notify({
        subject:
          down.length > 0
            ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
            : "Cloudflare Workers: すべてのアプリが復旧しました",
        text: formatHealthMessage(decision.notifications),
      });
    await this.ctx.storage.put("state", decision.state);
    return {
      down,
      services: Object.fromEntries(results.map((result) => [result.service, result.detail])),
      notified: decision.notifications.length,
    };
  }
}

export default monitorHandler("health_monitor");
