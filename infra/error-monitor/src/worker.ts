import { monitorWorker, type MonitorBindings } from "@repo/monitor";
import { withSpan } from "@repo/observability";
import { Effect } from "effect";

import {
  errorMonitorWorker,
  observabilityQueryEndpoint,
  parseErrorMonitorConfig,
  type ErrorMonitorEnv,
} from "./config.ts";
import { decideNotifications, formatMessage, type SeenFingerprints } from "./decision.ts";
import { fetchErrorGroups } from "./telemetry.ts";

const LOOKBACK_MS = 900_000;

const errorMonitor = monitorWorker<MonitorBindings & ErrorMonitorEnv>({
  check({ ctx, env }, notify) {
    return Effect.gen(function* program() {
      const config = yield* parseErrorMonitorConfig(env);
      const observedAtMs = Date.now();
      const { dropped, groups } = yield* fetchErrorGroups({
        accountId: config.CLOUDFLARE_ACCOUNT_ID,
        from: observedAtMs - LOOKBACK_MS,
        queryEndpoint: observabilityQueryEndpoint(config.CLOUDFLARE_ACCOUNT_ID),
        to: observedAtMs,
        token: config.OBSERVABILITY_TOKEN,
      });
      const seenFingerprints = yield* Effect.promise(async () =>
        ctx.storage.get<SeenFingerprints>("seen"),
      );
      const decision = decideNotifications({
        errorGroups: groups,
        observedAtMs,
        seenFingerprints: seenFingerprints ?? {},
      });
      if (decision.notifications.length > 0) {
        yield* notify({
          subject: `Cloudflare Workers: ${decision.notifications.length} new or regressed errors`,
          text: formatMessage(decision.notifications),
        });
      }
      yield* Effect.promise(async () => ctx.storage.put("seen", decision.seen));
      return { dropped, groups: groups.length, notified: decision.notifications.length };
    }).pipe(withSpan("ErrorMonitor.check"));
  },
  event: errorMonitorWorker.event,
  failure: {
    subject: "Cloudflare Workers error monitoring failed",
    text: "Cloudflare Workers のエラー監視が失敗しました。error_monitor.check_failed のログを確認してください。エラーが 0 件だとは判断しないでください。",
  },
});

class ErrorMonitor extends errorMonitor.Worker {}

export { ErrorMonitor };
export default errorMonitor.handler;
