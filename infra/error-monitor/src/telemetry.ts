import { Effect, Schema } from "effect";

import { ErrorMonitorFailure } from "./config.ts";

type ErrorGroup = {
  readonly fingerprint: string;
  readonly service: string;
  readonly event: string;
  readonly type: string;
  readonly count: number;
};

type QueryWindow = {
  readonly accountId: string;
  readonly token: string;
  readonly from: number;
  readonly to: number;
};

const REQUEST_TIMEOUT_MS = 15_000;
const QUERY_LIMIT = 50;
const groupKeys = ["error.fingerprint", "service", "event", "error.type"] as const;
const Scalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]);
const GroupValue = Schema.Struct({ key: Schema.String, value: Scalar });
const GroupValues = Schema.Array(GroupValue);
const Aggregate = Schema.Struct({ count: Schema.Finite, groups: Schema.optionalKey(GroupValues) });
const Calculation = Schema.Struct({ aggregates: Schema.Array(Aggregate) });
const noCalculations = Effect.succeed([]);
const Calculations = Schema.Array(Calculation).pipe(Schema.withDecodingDefaultKey(noCalculations));
const QueryEnvelope = Schema.Struct({
  result: Schema.Struct({ calculations: Calculations }),
  success: Schema.Literal(true),
});

const errorGroup = (item: typeof Aggregate.Type): ErrorGroup[] => {
  const values = new Map((item.groups ?? []).map((entry) => [entry.key, String(entry.value)]));
  const fingerprint = values.get("error.fingerprint");
  if (fingerprint === undefined || !/^[0-9a-f]{8}$/u.test(fingerprint)) {
    return [];
  }
  return [
    {
      count: item.count,
      event: values.get("event") ?? "unknown",
      fingerprint,
      service: values.get("service") ?? "unknown",
      type: values.get("error.type") ?? "Error",
    },
  ];
};

const queryBody = (window: QueryWindow): string => {
  return JSON.stringify({
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
};

const failure = (code: ErrorMonitorFailure["code"]): (() => ErrorMonitorFailure) => {
  return () => new ErrorMonitorFailure({ code });
};

const queryTelemetry = (window: QueryWindow): Effect.Effect<Response, ErrorMonitorFailure> => {
  return Effect.tryPromise({
    catch: failure("telemetry_http_failed"),

    try: async (signal) =>
      fetch(
        `https://api.cloudflare.com/client/v4/accounts/${window.accountId}/workers/observability/telemetry/query`,
        {
          body: queryBody(window),
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
};

const fetchErrorGroups = Effect.fn("fetchErrorGroups")(function* fetchErrorGroups(
  window: QueryWindow,
) {
  if (!/^[a-f0-9]{32}$/u.test(window.accountId)) {
    return yield* failure("telemetry_account_invalid")();
  }
  const response = yield* queryTelemetry(window);
  if (!response.ok) {
    return yield* failure("telemetry_http_failed")();
  }
  const body = yield* Effect.tryPromise({
    catch: failure("telemetry_response_invalid"),
    try: async (): Promise<unknown> => response.json(),
  });
  const parsed = yield* Schema.decodeUnknownEffect(QueryEnvelope)(body).pipe(
    Effect.mapError(failure("telemetry_response_invalid")),
  );
  return parsed.result.calculations.flatMap((entry) =>
    entry.aggregates.flatMap((item) => errorGroup(item)),
  );
});

export { fetchErrorGroups };
export type { ErrorGroup };
