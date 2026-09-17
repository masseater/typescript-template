import { Effect, Result, Schema } from "effect";

class ExplorerFailure extends Schema.TaggedError<ExplorerFailure>()("ExplorerFailure", {
  reason: Schema.Literals([
    "origin_invalid",
    "request_id_invalid",
    "query_failed",
    "response_invalid",
  ]),
}) {}

const QueryResponse = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Struct({
    columns: Schema.Array(Schema.String),
    rows: Schema.Array(Schema.Array(Schema.Unknown)),
  }),
});

const RequestId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
);

export const explorerOrigin = Effect.fn("explorerOrigin")(function* (app: string) {
  const url = yield* Effect.try({
    try: () => new URL(app),
    catch: () => new ExplorerFailure({ reason: "origin_invalid" }),
  });
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    return yield* new ExplorerFailure({ reason: "origin_invalid" });
  return url;
});

const queryFailed = () => new ExplorerFailure({ reason: "query_failed" });
const responseInvalid = () => new ExplorerFailure({ reason: "response_invalid" });

export const queryExplorer = Effect.fn("queryExplorer")(function* (
  app: string,
  sql: string,
  params: readonly (string | number)[] = [],
) {
  const origin = yield* explorerOrigin(app);
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(new URL("/cdn-cgi/local/explorer/api/local/observability/query", origin), {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ sql, params }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        redirect: "error",
      }),
    catch: queryFailed,
  });
  if (!response.ok) return yield* queryFailed();
  const body = yield* Effect.tryPromise({ try: () => response.json(), catch: responseInvalid });
  const { columns, rows } = (yield* Schema.decodeUnknownEffect(QueryResponse)(body).pipe(
    Effect.mapError(responseInvalid),
  )).result;
  return rows.map((row): Record<string, unknown> =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
});

export function structuredMessage(message: unknown): Record<string, unknown> | undefined {
  if (typeof message !== "string") return undefined;
  return Result.getOrUndefined(
    Result.try(() => {
      const args: unknown = JSON.parse(message);
      const first: unknown = Array.isArray(args) ? args[0] : args;
      const parsed: unknown = typeof first === "string" ? JSON.parse(first) : undefined;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.fromEntries(Object.entries(parsed))
        : undefined;
    }),
  );
}

export const requestTelemetry = Effect.fn("requestTelemetry")(function* (
  app: string,
  requestId: string,
) {
  yield* Schema.decodeUnknownEffect(RequestId)(requestId).pipe(
    Effect.mapError(() => new ExplorerFailure({ reason: "request_id_invalid" })),
  );
  const pattern = `request_id\\":\\"${requestId}`;
  const logs = yield* queryExplorer(
    app,
    "SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE instr(message, ?) > 0 ORDER BY ts_ms LIMIT 500",
    [pattern],
  );
  const spans = yield* queryExplorer(
    app,
    "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id IN (SELECT trace_id FROM logs WHERE instr(message, ?) > 0) ORDER BY start_ms LIMIT 2000",
    [pattern],
  );
  return {
    logs: logs.map(({ message, ...row }) => ({ ...row, event: structuredMessage(message) })),
    spans,
  };
});
