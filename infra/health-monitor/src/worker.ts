import { Monitor, monitorHandler } from "@repo/monitor";
import { Effect } from "effect";

import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import { probeService } from "./probe.ts";

import type { MonitorBindings, Notify } from "@repo/monitor";
import type { HealthState } from "./decision.ts";

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

  protected check(notify: Notify): Effect.Effect<object, unknown> {
    const { env, ctx } = this;
    return Effect.gen(function* program() {
      const config = yield* parseHealthMonitorConfig(env);
      const results = yield* Effect.all(
        healthTargets(config).map((target) => probeService(target)),
        {
          concurrency: "unbounded",
        },
      );
      const previous = yield* Effect.promise(async () => ctx.storage.get<HealthState>("state"));
      const decision = decideHealthAlerts(results, previous ?? {});
      const down = results.filter((result) => !result.healthy).map((result) => result.service);
      if (decision.notifications.length > 0) {
        yield* notify({
          subject:
            down.length > 0
              ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
              : "Cloudflare Workers: すべてのアプリが復旧しました",
          text: formatHealthMessage(decision.notifications),
        });
      }
      yield* Effect.promise(async () => ctx.storage.put("state", decision.state));
      return {
        down,
        notified: decision.notifications.length,
        services: Object.fromEntries(results.map((result) => [result.service, result.detail])),
      };
    }).pipe(Effect.withSpan("HealthMonitor.check"));
  }
}

export default monitorHandler("health_monitor");
