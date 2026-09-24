import { moderationKinds, reportReasons, reportStatuses } from "@repo/config";
import { Acknowledged, IdentifierQuery } from "@repo/runtime/contracts";
import { Effect, Schema } from "effect";

const maximumReportPage = 1_000_000;
const reportPageSize = 20;

function pageNumber(fallback: number): Schema.withDecodingDefaultKey<Schema.FiniteFromString> {
  const bounded = Schema.FiniteFromString.check(
    Schema.isInt(),
    Schema.isBetween({ maximum: maximumReportPage, minimum: 1 }),
  );
  return bounded.pipe(Schema.withDecodingDefaultKey(Effect.succeed(String(fallback))));
}

const ReportListQuery = Schema.Struct({
  page: pageNumber(1),
  status: Schema.optionalKey(Schema.Literals(reportStatuses)),
});

const ReportSummary = Schema.Struct({
  createdAt: Schema.Finite,
  id: Schema.String,
  reason: Schema.Literals(reportReasons),
  reporterName: Schema.NullOr(Schema.String),
  status: Schema.Literals(reportStatuses),
  targetName: Schema.NullOr(Schema.String),
});

const ReportList = Schema.Struct({
  pageSize: Schema.Literal(reportPageSize),
  reports: Schema.Array(ReportSummary),
  total: Schema.Finite,
});

const ReportQuery = IdentifierQuery;

const ModerationRecord = Schema.Struct({
  createdAt: Schema.Finite,
  id: Schema.String,
  kind: Schema.Literals(moderationKinds),
});

const ReportDetail = Schema.Struct({
  actions: Schema.Array(ModerationRecord),
  body: Schema.String,
  createdAt: Schema.Finite,
  id: Schema.String,
  reason: Schema.Literals(reportReasons),
  reporterId: Schema.NullOr(Schema.String),
  reporterName: Schema.NullOr(Schema.String),
  status: Schema.Literals(reportStatuses),
  targetEmail: Schema.NullOr(Schema.String),
  targetMemberId: Schema.NullOr(Schema.String),
  targetName: Schema.NullOr(Schema.String),
  targetSuspended: Schema.Boolean,
});

const ReportAction = IdentifierQuery;

const ReportActionResult = Acknowledged;

export {
  ReportAction,
  ReportActionResult,
  ReportDetail,
  ReportList,
  ReportListQuery,
  ReportQuery,
  reportPageSize,
};
