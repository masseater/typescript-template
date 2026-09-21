import { auditActions, clientKinds, metricKeys, metricPeriods } from "@repo/db/dashboard-literals";
import { Schema } from "effect";

const OverviewCard = Schema.Struct({
  metric: Schema.Literals(metricKeys),
  value: Schema.Finite,
});

const MetricTrendPoint = Schema.Struct({
  bucket: Schema.String,
  clientKind: Schema.Literals(clientKinds),
  value: Schema.Finite,
});

const MetricTrend = Schema.Array(MetricTrendPoint);

const StaffOverview = Schema.Struct({
  cards: Schema.Array(OverviewCard),
  trend: MetricTrend,
});

const AuditEventView = Schema.Struct({
  action: Schema.Literals(auditActions),
  actorId: Schema.String,
  createdAt: Schema.DateFromString,
  id: Schema.String,
  targetId: Schema.String,
});

const StaffAuditPage = Schema.Struct({
  events: Schema.Array(AuditEventView),
  total: Schema.Finite,
});

const AuditPageQuery = Schema.Struct({
  action: Schema.optionalKey(Schema.Literals(auditActions)),
  actorId: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  targetId: Schema.optionalKey(Schema.String),
});

const TrendQuery = Schema.Struct({
  days: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ maximum: 365, minimum: 1 }))),
  metric: Schema.Literals(metricKeys),
  period: Schema.Literals(metricPeriods),
});

type StaffAuditPageView = typeof StaffAuditPage.Type;
type StaffOverviewView = typeof StaffOverview.Type;

export { AuditPageQuery, MetricTrend, StaffAuditPage, StaffOverview, TrendQuery };
export type { StaffAuditPageView, StaffOverviewView };
