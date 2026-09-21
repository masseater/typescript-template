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
      const acceptedConfig = yield* parseHealthMonitorConfig(env);
      const probeResults = yield* Effect.all(
        healthTargets(acceptedConfig).map((healthTarget) => probeService(healthTarget)),
        {
          concurrency: "unbounded",
        },
      );
      const priorState = yield* Effect.promise(async () => ctx.storage.get<HealthState>("state"));
      const decision = decideHealthAlerts(probeResults, priorState ?? {});
      const down = probeResults
        .filter((probeResult) => !probeResult.healthy)
        .map((probeResult) => probeResult.service);
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
        services: Object.fromEntries(
          probeResults.map((probeResult) => [probeResult.service, probeResult.detail]),
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
