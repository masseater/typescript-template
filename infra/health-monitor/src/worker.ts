import { Monitor, monitorHandler } from "@template/monitor";
import type { MonitorBindings, Notify } from "@template/monitor";
import { Effect } from "effect";
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

  protected check(notify: Notify) {
    const { env, ctx } = this;
    return Effect.gen(function* () {
      const config = yield* parseHealthMonitorConfig(env);
      const results = yield* Effect.all(healthTargets(config).map(probeService), {
        concurrency: "unbounded",
      });
      const previous = yield* Effect.promise(() => ctx.storage.get<HealthState>("state"));
      const decision = decideHealthAlerts(results, previous ?? {});
      const down = results.filter((result) => !result.healthy).map((result) => result.service);
      if (decision.notifications.length > 0)
        yield* notify({
          subject:
            down.length > 0
              ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
              : "Cloudflare Workers: すべてのアプリが復旧しました",
          text: formatHealthMessage(decision.notifications),
        });
      yield* Effect.promise(() => ctx.storage.put("state", decision.state));
      return {
        down,
        services: Object.fromEntries(results.map((result) => [result.service, result.detail])),
        notified: decision.notifications.length,
      };
    }).pipe(Effect.withSpan("HealthMonitor.check"));
  }
}

export default monitorHandler("health_monitor");
