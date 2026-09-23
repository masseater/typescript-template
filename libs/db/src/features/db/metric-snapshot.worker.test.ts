import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { refreshMetricSnapshots } from "./metric-snapshot.ts";
import { addUser } from "./records-fixture.ts";
import { TestDatabase } from "./testing.ts";

describe("refreshMetricSnapshots", () => {
  const it = test.extend("refreshedSnapshots", () =>
    Effect.runPromise(
      Effect.gen(function* refreshSnapshots() {
        yield* addUser({ userId: "member" });
        const refreshed = yield* refreshMetricSnapshots();
        return {
          computedAtIsDate: refreshed.computedAt instanceof Date,
          metricsRecorded: refreshed.metricCount > 0,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("refreshes metric snapshots for scheduled aggregation", ({ refreshedSnapshots }) => {
    expect(refreshedSnapshots).toStrictEqual({ computedAtIsDate: true, metricsRecorded: true });
  });
});
