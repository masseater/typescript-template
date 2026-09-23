import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { TestDatabase } from "./database-test-fixture.ts";
import { refreshMetricSnapshots } from "./metric-snapshot.ts";
import { addUser } from "./records-test-fixture.ts";

it.effect("refreshes metric snapshots for scheduled aggregation", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    const result = yield* refreshMetricSnapshots();
    assert.isAbove(result.metricCount, 0);
    assert.instanceOf(result.computedAt, Date);
  }).pipe(Effect.provide(TestDatabase)),
);
