import { Effect, Schema } from "effect";
import { queryExplorer, requestTelemetry, withEvent } from "./explorer.ts";
import { NodeRuntime } from "@effect/platform-node";
import { applicationPorts } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

class QueryFailure extends Schema.TaggedError<QueryFailure>()("QueryFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const commands = ["logs", "traces", "trace", "request"] as const;
const minutesPerDay = 1440;
const maxQueryLimit = 500;
const millisecondsPerMinute = 60_000;

const TraceId = Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/u));
const QueryLimit = Schema.Int.check(Schema.isBetween({ maximum: maxQueryLimit, minimum: 1 }));
const QueryMinutes = Schema.Int.check(Schema.isBetween({ maximum: minutesPerDay, minimum: 1 }));
const Level = Schema.Literals(["debug", "info", "log", "warn", "error"]);
const QueryInput = Schema.Struct({
  command: Schema.Literals(commands),
  level: Schema.optional(Level),
  limit: QueryLimit,
  minutes: QueryMinutes,
  requestId: Schema.optional(Schema.String),
  traceId: Schema.optional(TraceId),
});

type Query = typeof QueryInput.Type;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { default: `http://127.0.0.1:${applicationPorts.user}/`, type: "string" },
    help: { default: false, type: "boolean" },
    level: { type: "string" },
    limit: { default: "100", type: "string" },
    minutes: { default: "15", type: "string" },
    "request-id": { type: "string" },
    "trace-id": { type: "string" },
  },
});

function argumentsInvalid(): QueryFailure {
  return new QueryFailure({ reason: "arguments_invalid" });
}

function required(value: string | undefined): Effect.Effect<string, QueryFailure> {
  return value === undefined ? Effect.fail(argumentsInvalid()) : Effect.succeed(value);
}

function queryLogs(app: string, input: Query, since: number): Effect.Effect<unknown, unknown> {
  const levelFilter = input.level === undefined ? "" : " AND level = ?";
  const params =
    input.level === undefined ? [since, input.limit] : [since, input.level, input.limit];
  return queryExplorer(
    app,
    `SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE ts_ms >= ?${levelFilter} ORDER BY ts_ms DESC LIMIT ?`,
    params,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ).pipe(Effect.map((rows) => rows.map((row) => withEvent(row))));
}

function runQuery(app: string, input: Query): Effect.Effect<unknown, unknown> {
  const since = Date.now() - input.minutes * millisecondsPerMinute;
  if (input.command === "request") {
    return required(input.requestId).pipe(
      Effect.flatMap((requestId) => requestTelemetry(app, requestId)),
    );
  }
  if (input.command === "trace") {
    return required(input.traceId).pipe(
      Effect.flatMap((traceId) =>
        queryExplorer(
          app,
          "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id = ? ORDER BY start_ms LIMIT 2000",
          [traceId],
        ),
      ),
    );
  }
  if (input.command === "traces") {
    return queryExplorer(
      app,
      "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
      [since, input.limit],
    );
  }
  return queryLogs(app, input, since);
}

const help = Effect.sync(() => {
  process.stdout.write(
    `${JSON.stringify({
      commands,
      flags: ["--app", "--minutes", "--limit", "--level", "--request-id", "--trace-id"],
      readOnly: true,
      source: "Cloudflare Local Explorer of the running app",
    })}\n`,
  );
});

const query = Effect.fn("query")(function* query() {
  const input = yield* Schema.decodeUnknownEffect(QueryInput)({
    command: positionals[0],
    level: values.level,
    limit: Number(values.limit),
    minutes: Number(values.minutes),
    requestId: values["request-id"],
    traceId: values["trace-id"],
  }).pipe(Effect.mapError(argumentsInvalid));
  if (positionals.length !== 1) {
    return yield* argumentsInvalid();
  }
  const data = yield* runQuery(values.app, input);
  process.stdout.write(
    `${JSON.stringify({ command: input.command, data, observedAt: new Date().toISOString(), ok: true })}\n`,
  );
  return data;
});

NodeRuntime.runMain(
  (values.help ? help : query()).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({
            event: "observability.query_failed",
            ok: false,
            remediation:
              "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
          })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
