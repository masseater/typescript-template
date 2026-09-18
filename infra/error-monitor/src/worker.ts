import { Monitor, monitorHandler, type MonitorBindings, type Notify } from "@template/monitor";
import { Effect } from "effect";

import { parseErrorMonitorConfig } from "./config.ts";
import { decideNotifications, formatMessage, type SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

type Bindings = {
  CLOUDFLARE_ACCOUNT_ID: string;
  OBSERVABILITY_TOKEN: string;
} & MonitorBindings;

const LOOKBACK_MS = 900_000;

export class ErrorMonitor extends Monitor<Bindings> {
  protected readonly eventName = "error_monitor";
  protected readonly failure = {
    subject: "Cloudflare Workers error monitoring failed",
    text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
  };

  protected check(notify: Notify): Effect.Effect<object, unknown> {
    const { env, ctx } = this;
    return Effect.gen(function* program() {
      const config = yield* parseErrorMonitorConfig(env);
      const now = Date.now();
      const groups = yield* fetchErrorGroups({
        accountId: config.CLOUDFLARE_ACCOUNT_ID,
        from: now - LOOKBACK_MS,
        to: now,
        token: config.OBSERVABILITY_TOKEN,
      });
      const seen = yield* Effect.promise(async () => ctx.storage.get<SeenFingerprints>("seen"));
      const decision = decideNotifications(groups, seen ?? {}, now);
      if (decision.notifications.length > 0) {
        yield* notify({
          subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
          text: formatMessage(decision.notifications),
        });
      }
      yield* Effect.promise(async () => ctx.storage.put("seen", decision.seen));
      return { groups: groups.length, notified: decision.notifications.length };
    }).pipe(Effect.withSpan("ErrorMonitor.check"));
  }
}

export default monitorHandler("error_monitor");
