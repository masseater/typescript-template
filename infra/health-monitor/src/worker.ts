import { monitorWorker, type MonitorBindings } from "@repo/monitor";
import { withSpan } from "@repo/observability";
import { Effect } from "effect";

import {
  healthMonitorWorker,
  healthTargets,
  parseHealthMonitorConfig,
  type HealthMonitorEnv,
} from "./config.ts";
import { decideHealthAlerts, formatHealthMessage, type HealthState } from "./decision.ts";
import { probeService } from "./probe.ts";

const health = monitorWorker<MonitorBindings & HealthMonitorEnv>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseHealthMonitorConfig(env);
      const checkedHealths = yield* Effect.all(
        healthTargets(config).map((healthTarget) => probeService(healthTarget)),
        {
          concurrency: "unbounded",
        },
      );
      const previousHealth = yield* Effect.promise(async () =>
        ctx.storage.get<HealthState>("state"),
      );
      const decision = decideHealthAlerts(checkedHealths, previousHealth ?? {});
      const downServices = checkedHealths
        .filter((checkedHealth) => !checkedHealth.healthy)
        .map((checkedHealth) => checkedHealth.service);
      if (decision.notifications.length > 0) {
        yield* notify({
          subject:
            downServices.length > 0
              ? `Cloudflare Workers: ${downServices.join(", ")} が応答しません`
              : "Cloudflare Workers: すべてのアプリが復旧しました",
          text: formatHealthMessage(decision.notifications),
        });
      }
      yield* Effect.promise(async () => ctx.storage.put("state", decision.healthByService));
      return {
        down: downServices,
        notified: decision.notifications.length,
        services: Object.fromEntries(
          checkedHealths.map((checkedHealth) => [checkedHealth.service, checkedHealth.detail]),
        ),
      };
    }).pipe(withSpan("HealthMonitor.check"));
  },
  event: healthMonitorWorker.event,
  failure: {
    subject: "Cloudflare Workers health monitoring failed",
    text: "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
  },
});

class HealthMonitor extends health.Worker {}

export { HealthMonitor };
export default health.handler;
