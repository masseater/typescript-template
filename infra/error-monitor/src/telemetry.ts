import { CloudflareId } from "@repo/config";
import { Effect, Schema, SchemaIssue } from "effect";

import { ErrorMonitorFailure } from "./config.ts";

import type { StandardSchema } from "effect";

interface ErrorGroup {
  readonly fingerprint: string;
  readonly service: string | undefined;
  readonly event: string | undefined;
  readonly tag: string | undefined;
  readonly type: string | undefined;
  readonly count: number;
}

interface ErrorGroups {
  readonly groups: readonly ErrorGroup[];
  readonly dropped: number;
}

interface QueryWindow {
  readonly accountId: string;
  readonly token: string;
  readonly from: number;
  readonly to: number;
}

const isCloudflareId = Schema.is(CloudflareId);
const REQUEST_TIMEOUT_MS = 15_000;
const QUERY_LIMIT = 2000;
const WHOLE_BODY = "$";
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

const issueFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => issue._tag,
});

function mismatches(failure: StandardSchema.StandardSchemaV1.FailureResult): readonly string[] {
  return failure.issues.map((issue) => {
    const path = (issue.path ?? [])
      .map((key) => (typeof key === "object" ? String(key.key) : String(key)))
      .join(".");
    return `${path === "" ? WHOLE_BODY : path}:${issue.message}`;
  });
}

function failure(
  code: ErrorMonitorFailure["code"],
  keys: readonly string[] = [],
): () => ErrorMonitorFailure {
  return () => new ErrorMonitorFailure({ code, keys });
}

function errorGroup(item: typeof Aggregate.Type): {
  readonly group?: ErrorGroup;
  readonly dropped: 0 | 1;
} {
  const values = new Map((item.groups ?? []).map((entry) => [entry.key, String(entry.value)]));
  const fingerprint = values.get("error.fingerprint");
  if (fingerprint === undefined || !FINGERPRINT.test(fingerprint)) {
    return { dropped: 1 };
  }
  return {
    dropped: 0,
    group: {
      count: item.count,
      event: values.get("event"),
      fingerprint,
      service: values.get("service"),
      tag: values.get("error.tag"),
      type: values.get("error.type"),
    },
  };
}

function queryBody(window: QueryWindow, offsetBy: number): string {
  return JSON.stringify({
    chartType: "aggregate",
    ignoreSeries: true,
    limit: QUERY_LIMIT,
    offsetBy,
    parameters: {
      calculations: [{ alias: "events", operator: "count" }],
      datasets: [],
      filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
      groupBys: groupKeys.map((value) => ({ type: "string", value })),
      limit: QUERY_LIMIT,
    },
    queryId: "error-monitor",
    timeframe: { from: window.from, to: window.to },
    view: "calculations",
  });
}

function queryTelemetry(
  window: QueryWindow,
  offsetBy: number,
): Effect.Effect<Response, ErrorMonitorFailure> {
  return Effect.tryPromise({
    catch: failure("telemetry_http_failed"),
    try: async (signal) =>
      fetch(
        `https://api.cloudflare.com/client/v4/accounts/${window.accountId}/workers/observability/telemetry/query`,
        {
          body: queryBody(window, offsetBy),
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${window.token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        },
      ),
  });
}

const fetchPage = Effect.fn("fetchPage")(function* fetchPage(
  window: QueryWindow,
  offsetBy: number,
) {
  const response = yield* queryTelemetry(window, offsetBy);
  if (!response.ok) {
    return yield* failure("telemetry_http_failed")();
  }
  const body = yield* Effect.tryPromise({
    catch: failure("telemetry_response_invalid"),
    try: async (): Promise<unknown> => response.json(),
  });
  const parsed = yield* Schema.decodeUnknownEffect(QueryEnvelope)(body).pipe(
    Effect.mapError(
      (error) =>
        new ErrorMonitorFailure({
          code: "telemetry_response_invalid",
          keys: mismatches(issueFormatter(error.issue)),
        }),
    ),
  );
  return parsed.result.calculations.flatMap((entry) => entry.aggregates);
});

const fetchErrorGroups = Effect.fn("fetchErrorGroups")(function* fetchErrorGroups(
  window: QueryWindow,
) {
  if (!isCloudflareId(window.accountId)) {
    return yield* failure("telemetry_account_invalid")();
  }
  const aggregates: (typeof Aggregate.Type)[] = [];
  let offsetBy = 0;
  for (;;) {
    const page = yield* fetchPage(window, offsetBy);
    aggregates.push(...page);
    if (page.length < QUERY_LIMIT) {
      break;
    }
    offsetBy += QUERY_LIMIT;
  }
  const collected = aggregates.map((item) => errorGroup(item));
  return {
    dropped: collected.reduce((total, item) => total + item.dropped, 0),
    groups: collected.flatMap((item) => (item.group === undefined ? [] : [item.group])),
  } satisfies ErrorGroups;
});

export { fetchErrorGroups };
export type { ErrorGroup };
