import { CloudflareId } from "@repo/config";
import { Effect, Redacted, Schema, SchemaIssue } from "effect";

import { ErrorMonitorFailure } from "./config.ts";

type ErrorGroup = {
  readonly fingerprint: string;
  readonly service: string | undefined;
  readonly event: string | undefined;
  readonly tag: string | undefined;
  readonly type: string | undefined;
  readonly count: number;
};

type QueryWindow = {
  readonly accountId: string;
  readonly token: Redacted.Redacted;
  readonly from: number;
  readonly to: number;
  readonly queryEndpoint: string;
};

const isCloudflareId = Schema.is(CloudflareId);
const REQUEST_TIMEOUT_MS = 15_000;
const QUERY_LIMIT = 2000;
const FINGERPRINT = /^[0-9a-f]{8}$/u;
const groupKeys = ["error.fingerprint", "service", "event", "error.tag", "error.type"] as const;
const Scalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]);
const GroupValue = Schema.Struct({ key: Schema.String, value: Scalar });
const GroupValues = Schema.Array(GroupValue);
const Aggregate = Schema.Struct({ count: Schema.Finite, groups: Schema.optionalKey(GroupValues) });
const Calculation = Schema.Struct({ aggregates: Schema.Array(Aggregate) });
const QueryEnvelope = Schema.Struct({
  result: Schema.Struct({ calculations: Schema.Array(Calculation) }),
  success: Schema.Literal(true),
});

const groupedError = (
  aggregateRow: typeof Aggregate.Type,
): {
  readonly grouped?: ErrorGroup;
  readonly dropped: 0 | 1;
} => {
  const fieldByKey = new Map(
    (aggregateRow.groups ?? []).map((groupField) => [groupField.key, String(groupField.value)]),
  );
  const fingerprint = fieldByKey.get("error.fingerprint");
  if (fingerprint === undefined || !FINGERPRINT.test(fingerprint)) {
    return { dropped: 1 };
  }
  return {
    dropped: 0,
    grouped: {
      count: aggregateRow.count,
      event: fieldByKey.get("event"),
      fingerprint,
      service: fieldByKey.get("service"),
      tag: fieldByKey.get("error.tag"),
      type: fieldByKey.get("error.type"),
    },
  };
};

const queryBody = (queryWindow: QueryWindow, offsetBy: number): string =>
  JSON.stringify({
    chartType: "aggregate",
    ignoreSeries: true,
    limit: QUERY_LIMIT,
    offsetBy,
    parameters: {
      calculations: [{ alias: "events", operator: "count" }],
      datasets: [],
      filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
      groupBys: groupKeys.map((groupKey) => ({ type: "string", value: groupKey })),
      limit: QUERY_LIMIT,
    },
    queryId: "error-monitor",
    timeframe: { from: queryWindow.from, to: queryWindow.to },
    view: "calculations",
  });

const telemetryFailure =
  (code: ErrorMonitorFailure["code"]): (() => ErrorMonitorFailure) =>
  () =>
    new ErrorMonitorFailure({ code, keys: [] });

const queryTelemetry = ({
  fetchImpl,
  offsetBy,
  queryWindow,
}: {
  readonly fetchImpl: typeof fetch;
  readonly offsetBy: number;
  readonly queryWindow: QueryWindow;
}): Effect.Effect<Response, ErrorMonitorFailure> =>
  Effect.tryPromise({
    catch: telemetryFailure("telemetry_http_failed"),
    try: (signal) =>
      fetchImpl(queryWindow.queryEndpoint, {
        body: queryBody(queryWindow, offsetBy),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${Redacted.value(queryWindow.token)}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      }),
  });

const fetchPage = Effect.fn("fetchPage")(function* fetchPage(
  queryWindow: QueryWindow,
  offsetBy: number,
): Generator<
  Effect.Effect<unknown, ErrorMonitorFailure>,
  readonly (typeof Aggregate.Type)[],
  never
> {
  const telemetryResponse = yield* queryTelemetry({ fetchImpl: fetch, offsetBy, queryWindow });
  if (!telemetryResponse.ok) {
    return yield* telemetryFailure("telemetry_http_failed")();
  }
  const telemetryPayload = yield* Effect.tryPromise({
    catch: telemetryFailure("telemetry_response_invalid"),
    try: () => telemetryResponse.json(),
  });
  const telemetryEnvelope = yield* Schema.decodeUnknownEffect(QueryEnvelope)(telemetryPayload).pipe(
    Effect.mapError((decodeError) => {
      const { issues } = SchemaIssue.makeFormatterStandardSchemaV1({
        leafHook: (leafIssue) => leafIssue._tag,
      })(decodeError.issue);
      return new ErrorMonitorFailure({
        code: "telemetry_response_invalid",
        keys: issues.map((mismatch) => {
          const mismatchPath = (mismatch.path ?? [])
            .map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
            .join(".");
          return `${mismatchPath === "" ? "$" : mismatchPath}:${mismatch.message}`;
        }),
      });
    }),
  );
  return telemetryEnvelope.result.calculations.flatMap(
    (calculationRow) => calculationRow.aggregates,
  );
});

const collectPages = Effect.fn("collectPages")(function* collectPages(asked: {
  readonly aggregates: readonly (typeof Aggregate.Type)[];
  readonly offsetBy: number;
  readonly queryWindow: QueryWindow;
}): Generator<
  Effect.Effect<unknown, ErrorMonitorFailure>,
  readonly (typeof Aggregate.Type)[],
  never
> {
  const page = yield* fetchPage(asked.queryWindow, asked.offsetBy);
  const collected = [...asked.aggregates, ...page];
  return page.length < QUERY_LIMIT
    ? collected
    : yield* collectPages({
        aggregates: collected,
        offsetBy: asked.offsetBy + QUERY_LIMIT,
        queryWindow: asked.queryWindow,
      });
});

const fetchErrorGroups = Effect.fn("fetchErrorGroups")(function* fetchErrorGroups(
  queryWindow: QueryWindow,
): Generator<
  Effect.Effect<unknown, ErrorMonitorFailure>,
  { readonly groups: readonly ErrorGroup[] },
  never
> {
  if (!isCloudflareId(queryWindow.accountId)) {
    return yield* telemetryFailure("telemetry_account_invalid")();
  }
  const aggregates = yield* collectPages({ aggregates: [], offsetBy: 0, queryWindow });
  const collected = aggregates.map((aggregateRow) => groupedError(aggregateRow));
  const droppedCount = collected.reduce(
    (droppedTotal, collectedGroup) => droppedTotal + collectedGroup.dropped,
    0,
  );
  if (droppedCount > 0) {
    return yield* new ErrorMonitorFailure({
      code: "telemetry_groups_dropped",
      keys: [`dropped:${String(droppedCount)}`],
    });
  }
  return {
    groups: collected.flatMap((collectedGroup) =>
      collectedGroup.grouped === undefined ? [] : [collectedGroup.grouped],
    ),
  };
});

export { fetchErrorGroups };
export type { ErrorGroup };
