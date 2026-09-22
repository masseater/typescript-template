import { refreshMetricSnapshots } from "@repo/db";
import { annotateSpan, flushTelemetry } from "@repo/observability";
import { Clock, Effect } from "effect";

import { runtime } from "./runtime.ts";

const refreshDashboardMetrics = Effect.fn("refreshDashboardMetrics")(
  function* refreshDashboardMetrics() {
    const startedAt = yield* Clock.currentTimeMillis;
    yield* annotateSpan({ "dashboard.metrics.refresh": "started" });
    const result = yield* refreshMetricSnapshots();
    yield* annotateSpan({
      "dashboard.metrics.computed_at": result.computedAt.toISOString(),
      "dashboard.metrics.duration_ms": (yield* Clock.currentTimeMillis) - startedAt,
      "dashboard.metrics.rows": result.metricCount,
    });
    return result;
  },
);

function handleScheduled(_event: ScheduledEvent): Promise<void> {
  return runtime
    .runPromise(
      refreshDashboardMetrics().pipe(
        Effect.tap(() => flushTelemetry),
        Effect.orDie,
      ),
    )
    .then(() => undefined);
}

export { handleScheduled };
