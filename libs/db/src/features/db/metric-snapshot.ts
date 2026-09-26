import {
  APPLICATION,
  METRIC_KEY,
  METRIC_PERIOD,
  ROLE,
  clientKinds,
  metricPeriods,
} from "@repo/config";
import { count, eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { AGGREGATE_CLIENT_KIND, clientKindOf, type ClientKind } from "./client-kind.ts";
import { query } from "./database.ts";
import { freshId } from "./fresh-id.ts";
import { metricSnapshot, session, user, type MetricKey, type MetricPeriod } from "./schema.ts";

const dailyBucket = (instant: Date): string => instant.toISOString().slice(0, 10);

const weeklyBucket = (instant: Date): string => {
  const utc = DateTime.toDate(
    DateTime.makeUnsafe(
      Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
    ),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = DateTime.toDate(DateTime.makeUnsafe(Date.UTC(utc.getUTCFullYear(), 0, 1)));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const bucketFor = (period: MetricPeriod, instant: Date): string =>
  period === METRIC_PERIOD.daily ? dailyBucket(instant) : weeklyBucket(instant);

const memberCount = Effect.fn("memberCount")(function* memberCountProgram() {
  const [memberTally] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(eq(user.role, ROLE.member)),
  );
  return memberTally?.count ?? 0;
});

const clientKindTotals = (
  sessionCounts: readonly Readonly<{ count: number; userAgent: string | null }>[],
): { clientKind: ClientKind; value: number }[] => {
  const sessionCountsByKind = Map.groupBy(sessionCounts, (sessionCount) =>
    clientKindOf(sessionCount.userAgent),
  );
  return clientKinds.map((clientKind) => ({
    clientKind,
    value: (sessionCountsByKind.get(clientKind) ?? []).reduce(
      (sessionTotal, sessionCount) => sessionTotal + sessionCount.count,
      0,
    ),
  }));
};

const wikiSessionCounts = Effect.fn("wikiSessionCounts")(function* wikiSessionCountsProgram() {
  const sessionCounts = yield* query((database) =>
    database
      .select({ count: count(), userAgent: session.userAgent })
      .from(session)
      .where(eq(session.audience, APPLICATION.internalDashboard))
      .groupBy(session.userAgent),
  );
  return clientKindTotals(sessionCounts);
});

const currentSnapshotValues = Effect.fn("currentSnapshotValues")(function* currentSnapshotValues() {
  const members = yield* memberCount();
  const wikiSessions = yield* wikiSessionCounts();
  const snapshotValues: Readonly<{
    clientKind: ClientKind;
    metric: MetricKey;
    value: number;
  }>[] = [
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.memberCount, value: members },
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.messageCount, value: 0 },
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.paidMemberCount, value: 0 },
    ...wikiSessions.map(({ clientKind, value }) => ({
      clientKind,
      metric: METRIC_KEY.wikiSessionCount,
      value,
    })),
  ];
  return snapshotValues;
});

const refreshMetricSnapshots = Effect.fn("refreshMetricSnapshots")(
  function* refreshMetricSnapshots() {
    const computedAt = DateTime.toDate(yield* DateTime.now);
    const snapshotValues = yield* currentSnapshotValues();
    for (const period of metricPeriods) {
      const bucket = bucketFor(period, computedAt);
      for (const snapshotValue of snapshotValues) {
        const snapshotId = yield* freshId;
        yield* query((database) =>
          database
            .insert(metricSnapshot)
            .values({
              bucket,
              clientKind: snapshotValue.clientKind,
              computedAt,
              id: snapshotId,
              metric: snapshotValue.metric,
              period,
              value: snapshotValue.value,
            })
            .onConflictDoUpdate({
              set: { computedAt, value: snapshotValue.value },
              target: [
                metricSnapshot.metric,
                metricSnapshot.period,
                metricSnapshot.bucket,
                metricSnapshot.clientKind,
              ],
            }),
        );
      }
    }
    return { computedAt, metricCount: snapshotValues.length * metricPeriods.length };
  },
);

export { bucketFor, currentSnapshotValues, refreshMetricSnapshots };
