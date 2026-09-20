import { refreshMetricSnapshots } from "@repo/db/dashboard-staff";
import { annotateSpan, flushTelemetry } from "@repo/observability";
import { Effect } from "effect";

import { runtime } from "./runtime.ts";

const refreshDashboardMetrics = Effect.fn("refreshDashboardMetrics")(
  function* refreshDashboardMetrics() {
    const startedAt = Date.now();
    yield* annotateSpan({ "dashboard.metrics.refresh": "started" });
    const result = yield* refreshMetricSnapshots();
    yield* annotateSpan({
      "dashboard.metrics.computed_at": result.computedAt.toISOString(),
      "dashboard.metrics.duration_ms": Date.now() - startedAt,
      "dashboard.metrics.rows": result.metricCount,
    });
    return result;
  },
);

async function handleScheduled(_event: ScheduledEvent): Promise<void> {
  await runtime.runPromise(
    refreshDashboardMetrics().pipe(
      Effect.tap(() => flushTelemetry),
      Effect.orDie,
    ),
  );
}

export { handleScheduled };
