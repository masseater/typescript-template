import { Effect, Schema } from "effect";
import { ErrorMonitorFailure } from "./config.ts";

const groupKeys = ["error.fingerprint", "service", "event", "error.type"] as const;
const Group = Schema.Struct({
  key: Schema.String,
  value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]),
});
const QueryEnvelope = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Struct({
    calculations: Schema.Array(
      Schema.Struct({
        aggregates: Schema.Array(
          Schema.Struct({ count: Schema.Finite, groups: Schema.optionalKey(Schema.Array(Group)) }),
        ),
      }),
    ).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  }),
});

export interface ErrorGroup {
  fingerprint: string;
  service: string;
  event: string;
  type: string;
  count: number;
}

const failure = (code: ErrorMonitorFailure["code"]) => () => new ErrorMonitorFailure({ code });

export const fetchErrorGroups = Effect.fn("fetchErrorGroups")(function* (
  accountId: string,
  token: string,
  from: number,
  to: number,
) {
  if (!/^[a-f0-9]{32}$/.test(accountId)) return yield* failure("telemetry_account_invalid")();
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queryId: "error-monitor",
            timeframe: { from, to },
            view: "calculations",
            parameters: {
              datasets: [],
              filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
              calculations: [{ operator: "count", alias: "events" }],
              groupBys: groupKeys.map((value) => ({ type: "string", value })),
              limit: 50,
            },
          }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          redirect: "manual",
        },
      ),
    catch: failure("telemetry_http_failed"),
  });
  if (!response.ok) return yield* failure("telemetry_http_failed")();
  const body = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: failure("telemetry_response_invalid"),
  });
  const parsed = yield* Schema.decodeUnknownEffect(QueryEnvelope)(body).pipe(
    Effect.mapError(failure("telemetry_response_invalid")),
  );
  return parsed.result.calculations.flatMap((calculation) =>
    calculation.aggregates.flatMap((aggregate): ErrorGroup[] => {
      const values = Object.fromEntries(
        (aggregate.groups ?? []).map((item) => [item.key, String(item.value)]),
      );
      const fingerprint = values["error.fingerprint"];
      if (!fingerprint || !/^[0-9a-f]{8}$/.test(fingerprint)) return [];
      return [
        {
          fingerprint,
          service: values["service"] ?? "unknown",
          event: values["event"] ?? "unknown",
          type: values["error.type"] ?? "Error",
          count: aggregate.count,
        },
      ];
    }),
  );
});
