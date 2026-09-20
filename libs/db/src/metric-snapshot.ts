import { APPLICATION, ROLE } from "@repo/config";
import { and, count, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import { AGGREGATE_CLIENT_KIND, clientKindOf, type ClientKind } from "./client-kind.ts";
import { query } from "./database.ts";
import {
  METRIC_KEY,
  METRIC_PERIOD,
  clientKinds,
  metricPeriods,
  metricSnapshot,
  session,
  user,
  type MetricKey,
  type MetricPeriod,
} from "./schema.ts";

const dailyBucket = (instant: Date): string => instant.toISOString().slice(0, 10);

const weeklyBucket = (instant: Date): string => {
  const utc = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const bucketFor = (period: MetricPeriod, instant: Date): string =>
  period === METRIC_PERIOD.daily ? dailyBucket(instant) : weeklyBucket(instant);

type SnapshotValue = Readonly<{
  clientKind: ClientKind;
  metric: MetricKey;
  value: number;
}>;

const memberCount = Effect.fn("memberCount")(function* memberCountProgram() {
  const [row] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(eq(user.role, ROLE.member)),
  );
  return row?.count ?? 0;
});

const wikiSessionCounts = Effect.fn("wikiSessionCounts")(function* wikiSessionCountsProgram() {
  const rows = yield* query((database) =>
    database
      .select({ count: count(), userAgent: session.userAgent })
      .from(session)
      .where(eq(session.audience, APPLICATION.wiki))
      .groupBy(session.userAgent),
  );
  const totals = new Map<ClientKind, number>();
  for (const kind of clientKinds) {
    totals.set(kind, 0);
  }
  for (const row of rows) {
    const kind = clientKindOf(row.userAgent);
    totals.set(kind, (totals.get(kind) ?? 0) + row.count);
  }
  return [...totals.entries()].map(([clientKind, value]) => ({ clientKind, value }));
});

const currentSnapshotValues = Effect.fn("currentSnapshotValues")(function* currentSnapshotValues() {
  const members = yield* memberCount();
  const wikiSessions = yield* wikiSessionCounts();
  const values: SnapshotValue[] = [
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.memberCount, value: members },
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.messageCount, value: 0 },
    { clientKind: AGGREGATE_CLIENT_KIND, metric: METRIC_KEY.paidMemberCount, value: 0 },
    ...wikiSessions.map(({ clientKind, value }) => ({
      clientKind,
      metric: METRIC_KEY.wikiSessionCount,
      value,
    })),
  ];
  return values;
});

const refreshMetricSnapshots = Effect.fn("refreshMetricSnapshots")(
  function* refreshMetricSnapshots() {
    const computedAt = new Date();
    const values = yield* currentSnapshotValues();
    for (const period of metricPeriods) {
      const bucket = bucketFor(period, computedAt);
      for (const entry of values) {
        yield* query((database) =>
          database
            .insert(metricSnapshot)
            .values({
              bucket,
              clientKind: entry.clientKind,
              computedAt,
              id: crypto.randomUUID(),
              metric: entry.metric,
              period,
              value: entry.value,
            })
            .onConflictDoUpdate({
              set: { computedAt, value: entry.value },
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
    return { computedAt, metricCount: values.length * metricPeriods.length };
  },
);

export { bucketFor, currentSnapshotValues, refreshMetricSnapshots };
