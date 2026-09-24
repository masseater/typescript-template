import { auditActions, clientKinds, metricKeys } from "@repo/config";
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

type StaffAuditPageView = typeof StaffAuditPage.Type;
type StaffOverviewView = typeof StaffOverview.Type;

export { MetricTrend, StaffAuditPage, StaffOverview };
export type { StaffAuditPageView, StaffOverviewView };
