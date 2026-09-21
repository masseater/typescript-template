import {
  METRIC_KEY,
  METRIC_PERIOD,
  ROLE,
  auditActions,
  metricKeys,
  metricPeriods,
} from "@repo/config";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { AGGREGATE_CLIENT_KIND, type ClientKind } from "./client-kind.ts";
import { query } from "./database.ts";
import { bucketFor, currentSnapshotValues, refreshMetricSnapshots } from "./metric-snapshot.ts";
import { auditEvent, metricSnapshot, user, type AuditAction, type MetricKey } from "./schema.ts";

const MAX_PAGE_SIZE = 100;
const DEFAULT_TREND_DAYS = 30;

const AuditPage = Schema.Struct({
  action: Schema.optionalKey(Schema.Literals(auditActions)),
  actorId: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  targetId: Schema.optionalKey(Schema.String),
});

const TrendQuery = Schema.Struct({
  days: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ maximum: 365, minimum: 1 }))),
  metric: Schema.Literals(metricKeys),
  period: Schema.Literals(metricPeriods),
});

type AuditEventView = Readonly<{
  action: AuditAction;
  actorId: string;
  createdAt: Date;
  id: string;
  targetId: string;
}>;

type MetricTrendPoint = Readonly<{
  bucket: string;
  clientKind: ClientKind;
  value: number;
}>;

type OverviewCard = Readonly<{
  metric: MetricKey;
  value: number;
}>;

type OverviewMetrics = Readonly<{
  cards: readonly OverviewCard[];
  trend: readonly MetricTrendPoint[];
}>;

const overviewCardsFromSnapshots = Effect.fn("overviewCardsFromSnapshots")(
  function* overviewCardsFromSnapshotsProgram() {
    const [latest] = yield* query((database) =>
      database
        .select({ bucket: metricSnapshot.bucket })
        .from(metricSnapshot)
        .where(eq(metricSnapshot.period, METRIC_PERIOD.daily))
        .orderBy(desc(metricSnapshot.computedAt))
        .limit(1),
    );
    if (!latest) {
      return undefined;
    }
    const rows = yield* query((database) =>
      database
        .select({ metric: metricSnapshot.metric, value: metricSnapshot.value })
        .from(metricSnapshot)
        .where(
          and(
            eq(metricSnapshot.period, METRIC_PERIOD.daily),
            eq(metricSnapshot.bucket, latest.bucket),
            eq(metricSnapshot.clientKind, AGGREGATE_CLIENT_KIND),
          ),
        ),
    );
    const cards: OverviewCard[] = [];
    for (const metric of metricKeys) {
      if (metric === METRIC_KEY.wikiSessionCount) {
        continue;
      }
      const row = rows.find((candidate) => candidate.metric === metric);
      cards.push({ metric, value: row?.value ?? 0 });
    }
    return cards;
  },
);

const overviewCardsLive = Effect.fn("overviewCardsLive")(function* overviewCardsLiveProgram() {
  const values = yield* currentSnapshotValues();
  return values
    .filter(
      (entry) =>
        entry.clientKind === AGGREGATE_CLIENT_KIND && entry.metric !== METRIC_KEY.wikiSessionCount,
    )
    .map((entry) => ({ metric: entry.metric, value: entry.value }));
});

const metricTrend = Effect.fn("metricTrend")(function* metricTrendProgram(
  queryInput: typeof TrendQuery.Type,
) {
  const days = queryInput.days ?? DEFAULT_TREND_DAYS;
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days);
  const sinceBucket = bucketFor(queryInput.period, since);
  const untilBucket = bucketFor(queryInput.period, until);
  const rows = yield* query((database) =>
    database
      .select({
        bucket: metricSnapshot.bucket,
        clientKind: metricSnapshot.clientKind,
        value: metricSnapshot.value,
      })
      .from(metricSnapshot)
      .where(
        and(
          eq(metricSnapshot.metric, queryInput.metric),
          eq(metricSnapshot.period, queryInput.period),
          gte(metricSnapshot.bucket, sinceBucket),
          lte(metricSnapshot.bucket, untilBucket),
        ),
      )
      .orderBy(metricSnapshot.bucket, metricSnapshot.clientKind),
  );
  return rows.map((row): MetricTrendPoint => ({
    bucket: row.bucket,
    clientKind: row.clientKind ?? AGGREGATE_CLIENT_KIND,
    value: row.value,
  }));
});

const staffOverview = Effect.fn("staffOverview")(function* staffOverviewProgram() {
  const cards = (yield* overviewCardsFromSnapshots()) ?? (yield* overviewCardsLive());
  const trend = yield* metricTrend({
    days: DEFAULT_TREND_DAYS,
    metric: METRIC_KEY.memberCount,
    period: METRIC_PERIOD.daily,
  });
  return { cards, trend } satisfies OverviewMetrics;
});

const matchesAuditPage = (page: typeof AuditPage.Type) =>
  and(
    page.action === undefined ? undefined : eq(auditEvent.action, page.action),
    page.actorId === undefined ? undefined : eq(auditEvent.actorId, page.actorId),
    page.targetId === undefined ? undefined : eq(auditEvent.targetId, page.targetId),
  );

const staffAuditEvents = Effect.fn("staffAuditEvents")(function* staffAuditEventsProgram(
  page: typeof AuditPage.Type,
) {
  const events = yield* query((database) =>
    database
      .select({
        action: auditEvent.action,
        actorId: auditEvent.actorId,
        createdAt: auditEvent.createdAt,
        id: auditEvent.id,
        targetId: auditEvent.targetId,
      })
      .from(auditEvent)
      .where(matchesAuditPage(page))
      .orderBy(desc(auditEvent.createdAt), auditEvent.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [matching] = yield* query((database) =>
    database.select({ count: count() }).from(auditEvent).where(matchesAuditPage(page)),
  );
  return {
    events: events satisfies readonly AuditEventView[],
    total: matching?.count ?? 0,
  };
});

const staffOverviewWithoutPii = Effect.fn("staffOverviewWithoutPii")(
  function* staffOverviewWithoutPii() {
    const overview = yield* staffOverview();
    yield* query((database) =>
      database
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.role, ROLE.member))
        .limit(1),
    ).pipe(
      Effect.flatMap((rows) => {
        const [sample] = rows;
        if (!sample) {
          return Effect.void;
        }
        const serialized = JSON.stringify(overview);
        if (serialized.includes(sample.email) || serialized.includes(sample.name)) {
          return Effect.die("overview leaked personal data");
        }
        return Effect.void;
      }),
    );
    return overview;
  },
);

interface ReadOnlyDashboardStaff {
  readonly auditEvents: typeof staffAuditEvents;
  readonly metricTrend: typeof metricTrend;
  readonly overview: typeof staffOverview;
  readonly overviewWithoutPii: typeof staffOverviewWithoutPii;
}

const dashboardStaff: ReadOnlyDashboardStaff = {
  auditEvents: staffAuditEvents,
  metricTrend,
  overview: staffOverview,
  overviewWithoutPii: staffOverviewWithoutPii,
};

export { AuditPage, TrendQuery, dashboardStaff, refreshMetricSnapshots };
export type {
  AuditEventView,
  MetricTrendPoint,
  OverviewCard,
  OverviewMetrics,
  ReadOnlyDashboardStaff,
};
