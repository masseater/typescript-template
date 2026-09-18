import { Effect, Result, Schema } from "effect";
import { loopbackHosts } from "@template/config";

type Row = Record<string, unknown>;
type LogRow = Row & { readonly event: Row | undefined };

interface RequestTelemetry {
  readonly logs: LogRow[];
  readonly spans: Row[];
}

class ExplorerFailure extends Schema.TaggedError<ExplorerFailure>()("ExplorerFailure", {
  reason: Schema.Literals([
    "origin_invalid",
    "request_id_invalid",
    "query_failed",
    "response_invalid",
  ]),
}) {}

const explorerTimeoutMilliseconds = 15_000;
const loopbackHostSet: ReadonlySet<string> = new Set(loopbackHosts);
const Columns = Schema.Array(Schema.String);
const Rows = Schema.Array(Schema.Array(Schema.Unknown));
const QueryResult = Schema.Struct({ columns: Columns, rows: Rows });
const QueryResponse = Schema.Struct({ result: QueryResult, success: Schema.Literal(true) });
const RequestId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u),
);

function originInvalid(): ExplorerFailure {
  return new ExplorerFailure({ reason: "origin_invalid" });
}

function queryFailed(): ExplorerFailure {
  return new ExplorerFailure({ reason: "query_failed" });
}

function responseInvalid(): ExplorerFailure {
  return new ExplorerFailure({ reason: "response_invalid" });
}

function isLoopbackAppOrigin(url: Readonly<URL>): boolean {
  return (
    url.protocol === "http:" &&
    loopbackHostSet.has(url.hostname) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname === "/"
  );
}

function explorerOrigin(app: string): Effect.Effect<URL, ExplorerFailure> {
  const url = URL.parse(app);
  return url !== null && isLoopbackAppOrigin(url)
    ? Effect.succeed(url)
    : Effect.fail(originInvalid());
}

const queryExplorer = Effect.fn("queryExplorer")(function* queryExplorer(
  app: string,
  sql: string,
  params: readonly (string | number)[] = [],
) {
  const origin = yield* explorerOrigin(app);
  const response = yield* Effect.tryPromise({
    catch: queryFailed,
    try: async (signal) =>
      fetch(new URL("/cdn-cgi/local/explorer/api/local/observability/query", origin), {
        body: JSON.stringify({ params, sql }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(explorerTimeoutMilliseconds)]),
      }),
  });
  if (!response.ok) {
    return yield* queryFailed();
  }
  const body = yield* Effect.tryPromise({
    catch: responseInvalid,
    try: async (): Promise<unknown> => response.json(),
  });
  const { result } = yield* Schema.decodeUnknownEffect(QueryResponse)(body).pipe(
    Effect.mapError(responseInvalid),
  );
  return result.rows.map((row): Row =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
});

function parseStructured(message: string): Row | undefined {
  const args: unknown = JSON.parse(message);
  const first: unknown = Array.isArray(args) ? args[0] : args;
  const parsed: unknown = typeof first === "string" ? JSON.parse(first) : undefined;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? Object.fromEntries(Object.entries(parsed))
    : undefined;
}

function structuredMessage(message: unknown): Row | undefined {
  return typeof message === "string"
    ? Result.getOrUndefined(Result.try(() => parseStructured(message)))
    : undefined;
}

function withEvent({ message, ...row }: Readonly<Row>): LogRow {
  return { ...row, event: structuredMessage(message) };
}

const requestTelemetry = Effect.fn("requestTelemetry")(function* requestTelemetry(
  app: string,
  requestId: string,
) {
  yield* Schema.decodeUnknownEffect(RequestId)(requestId).pipe(
    Effect.mapError(() => new ExplorerFailure({ reason: "request_id_invalid" })),
  );
  const pattern = String.raw`request_id\":\"${requestId}`;
  const [logs, spans] = yield* Effect.all(
    [
      queryExplorer(
        app,
        "SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE instr(message, ?) > 0 ORDER BY ts_ms LIMIT 500",
        [pattern],
      ),
      queryExplorer(
        app,
        "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id IN (SELECT trace_id FROM logs WHERE instr(message, ?) > 0) ORDER BY start_ms LIMIT 2000",
        [pattern],
      ),
    ],
    { concurrency: "unbounded" },
  );
  const telemetry: RequestTelemetry = { logs: logs.map((row) => withEvent(row)), spans };
  return telemetry;
});

export { explorerOrigin, queryExplorer, requestTelemetry, withEvent };
