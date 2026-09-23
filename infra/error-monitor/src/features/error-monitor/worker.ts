import { monitorWorker } from "@repo/monitor";
import { Clock, Effect } from "effect";

import { errorMonitorWorker, parseErrorMonitorConfig, type ErrorMonitorEnv } from "./config.ts";
import { decideNotifications, formatMessage } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

import type { MonitorBindings } from "@repo/monitor";
import type { SeenFingerprints } from "./decision.ts";

interface Bindings extends MonitorBindings, ErrorMonitorEnv {}

const LOOKBACK_MS = 900_000;

const errorMonitor = monitorWorker<Bindings>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseErrorMonitorConfig(env);
      const now = yield* Clock.currentTimeMillis;
      const { dropped, groups } = yield* fetchErrorGroups({
        accountId: config.CLOUDFLARE_ACCOUNT_ID,
        from: now - LOOKBACK_MS,
        to: now,
        token: config.OBSERVABILITY_TOKEN,
      });
      const seen = yield* Effect.promise(() => ctx.storage.get<SeenFingerprints>("seen"));
      const decision = decideNotifications(groups, seen ?? {}, now);
      if (decision.notifications.length > 0) {
        yield* notify({
          subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
          text: formatMessage(decision.notifications),
        });
      }
      yield* Effect.promise(() => ctx.storage.put("seen", decision.seen));
      return { dropped, groups: groups.length, notified: decision.notifications.length };
    }).pipe(Effect.withSpan("ErrorMonitor.check"));
  },
  className: errorMonitorWorker.className,
  event: errorMonitorWorker.event,
  failure: {
    subject: "Cloudflare Workers error monitoring failed",
    text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
  },
});

const ErrorMonitor = errorMonitor.Worker;

export { ErrorMonitor };
export default errorMonitor.handler;
