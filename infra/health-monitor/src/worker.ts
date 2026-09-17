import { DurableObject } from "cloudflare:workers";
import { Effect, Exit } from "effect";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import type { HealthMonitorConfig } from "./config.ts";
import { decideHealthAlerts, formatHealthMessage } from "./decision.ts";
import type { HealthState } from "./decision.ts";
import { probeService } from "./probe.ts";

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  USER_ORIGIN: string;
  ADMIN_ORIGIN: string;
  WIKI_ORIGIN: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

const monitor = (storage: DurableObjectStorage, email: SendEmail) => {
  const send = (config: HealthMonitorConfig, subject: string, text: string) =>
    Effect.promise(() =>
      email.send({ from: config.ALERT_FROM, to: [...config.ALERT_TO], subject, text }),
    );

  const check = Effect.fn("HealthMonitor.check")(function* (config: HealthMonitorConfig) {
    const results = yield* Effect.all(healthTargets(config).map(probeService), {
      concurrency: "unbounded",
    });
    const previous = yield* Effect.promise(() => storage.get<HealthState>("state"));
    const decision = decideHealthAlerts(results, previous ?? {});
    const down = results.filter((result) => !result.healthy).map((result) => result.service);
    if (decision.notifications.length > 0)
      yield* send(
        config,
        down.length > 0
          ? `Cloudflare Workers: ${down.join(", ")} が応答しません`
          : "Cloudflare Workers: すべてのアプリが復旧しました",
        formatHealthMessage(decision.notifications),
      );
    yield* Effect.promise(() => storage.put("state", decision.state));
    yield* Effect.promise(() => storage.delete("failureNotifiedDay"));
    return { results, down, notified: decision.notifications.length };
  });

  const recordFailure = Effect.fn("HealthMonitor.recordFailure")(function* (
    config: HealthMonitorConfig,
    started: number,
  ) {
    const day = new Date(started).toISOString().slice(0, 10);
    if ((yield* Effect.promise(() => storage.get<string>("failureNotifiedDay"))) !== day) {
      yield* send(
        config,
        "Cloudflare Workers health monitoring failed",
        "アプリの死活監視が失敗しました。health_monitor.check_failed のログを確認してください。アプリが稼働しているとは判断しないでください。",
      );
      yield* Effect.promise(() => storage.put("failureNotifiedDay", day));
    }
  });

  return Effect.fn("HealthMonitor.run")(function* (env: unknown) {
    const config = yield* parseHealthMonitorConfig(env);
    const started = Date.now();
    const outcome = yield* Effect.exit(check(config));
    if (Exit.isSuccess(outcome)) {
      const { results, down, notified } = outcome.value;
      console.log(
        JSON.stringify({
          event: "health_monitor.checked",
          down,
          services: Object.fromEntries(
            results.map((result) => [result.service, result.detail] as const),
          ),
          notified,
          durationMs: Date.now() - started,
        }),
      );
      return Response.json({ ok: true, down, notified });
    }
    console.error(
      JSON.stringify({ event: "health_monitor.check_failed", durationMs: Date.now() - started }),
    );
    yield* recordFailure(config, started);
    return yield* Effect.die("health_monitor_check_failed");
  });
};

export class HealthMonitor extends DurableObject<Bindings> {
  override async fetch(): Promise<Response> {
    const run = monitor(this.ctx.storage, this.env.EMAIL);
    return this.ctx.blockConcurrencyWhile(() => Effect.runPromise(run(this.env)));
  }
}

export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
  scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
    return Effect.runPromise(
      Effect.gen(function* () {
        const stub = env.MONITOR.get(env.MONITOR.idFromName("application-health"));
        const result = yield* Effect.promise(() =>
          stub.fetch("https://health.internal/check", { method: "POST" }),
        );
        if (!result.ok) return yield* Effect.die("health_monitor_schedule_failed");
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
