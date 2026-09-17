import { DurableObject } from "cloudflare:workers";
import { Effect, Exit } from "effect";
import { parseErrorMonitorConfig } from "./config.ts";
import type { ErrorMonitorConfig } from "./config.ts";
import { decideNotifications, formatMessage } from "./decision.ts";
import type { SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  CLOUDFLARE_ACCOUNT_ID: string;
  OBSERVABILITY_TOKEN: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

const lookback = 15 * 60 * 1000;

const monitor = (storage: DurableObjectStorage, email: SendEmail) => {
  const send = (config: ErrorMonitorConfig, subject: string, text: string) =>
    Effect.promise(() =>
      email.send({ from: config.ALERT_FROM, to: [...config.ALERT_TO], subject, text }),
    );

  const check = Effect.fn("ErrorMonitor.check")(function* (
    config: ErrorMonitorConfig,
    now: number,
  ) {
    const groups = yield* fetchErrorGroups(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.OBSERVABILITY_TOKEN,
      now - lookback,
      now,
    );
    const seen = yield* Effect.promise(() => storage.get<SeenFingerprints>("seen"));
    const decision = decideNotifications(groups, seen ?? {}, now);
    if (decision.notifications.length > 0)
      yield* send(
        config,
        `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
        formatMessage(decision.notifications),
      );
    yield* Effect.promise(() => storage.put("seen", decision.seen));
    yield* Effect.promise(() => storage.delete("failureNotifiedDay"));
    return { groups: groups.length, notified: decision.notifications.length };
  });

  const recordFailure = Effect.fn("ErrorMonitor.recordFailure")(function* (
    config: ErrorMonitorConfig,
    now: number,
  ) {
    const day = new Date(now).toISOString().slice(0, 10);
    if ((yield* Effect.promise(() => storage.get<string>("failureNotifiedDay"))) !== day) {
      yield* send(
        config,
        "Cloudflare Workers error monitoring failed",
        "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
      );
      yield* Effect.promise(() => storage.put("failureNotifiedDay", day));
    }
  });

  return Effect.fn("ErrorMonitor.run")(function* (env: unknown) {
    const config = yield* parseErrorMonitorConfig(env);
    const now = Date.now();
    const outcome = yield* Effect.exit(check(config, now));
    if (Exit.isSuccess(outcome)) {
      console.log(
        JSON.stringify({
          event: "error_monitor.checked",
          ...outcome.value,
          durationMs: Date.now() - now,
        }),
      );
      return Response.json({ ok: true, notified: outcome.value.notified });
    }
    console.error(
      JSON.stringify({ event: "error_monitor.check_failed", durationMs: Date.now() - now }),
    );
    yield* recordFailure(config, now);
    return yield* Effect.die("error_monitor_check_failed");
  });
};

export class ErrorMonitor extends DurableObject<Bindings> {
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
        const stub = env.MONITOR.get(env.MONITOR.idFromName("account-errors"));
        const result = yield* Effect.promise(() =>
          stub.fetch("https://errors.internal/check", { method: "POST" }),
        );
        if (!result.ok) return yield* Effect.die("error_monitor_schedule_failed");
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
