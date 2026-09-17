import { parseArgs } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { applicationPorts } from "@template/config";
import { Effect, Schema } from "effect";
import { queryExplorer, requestTelemetry, structuredMessage } from "./explorer.ts";

class QueryFailure extends Schema.TaggedError<QueryFailure>()("QueryFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const commands = ["logs", "traces", "trace", "request"] as const;

const QueryInput = Schema.Struct({
  command: Schema.Literals(commands),
  minutes: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1440 })),
  limit: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 500 })),
  level: Schema.optional(Schema.Literals(["debug", "info", "log", "warn", "error"])),
  requestId: Schema.optional(Schema.String),
  traceId: Schema.optional(Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/))),
});

const argumentsInvalid = () => new QueryFailure({ reason: "arguments_invalid" });

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string", default: `http://127.0.0.1:${applicationPorts.user}/` },
    minutes: { type: "string", default: "15" },
    limit: { type: "string", default: "100" },
    level: { type: "string" },
    "request-id": { type: "string" },
    "trace-id": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const help = Effect.sync(() =>
  console.info(
    JSON.stringify({
      commands,
      flags: ["--app", "--minutes", "--limit", "--level", "--request-id", "--trace-id"],
      source: "Cloudflare Local Explorer of the running app",
      readOnly: true,
    }),
  ),
);

const query = Effect.gen(function* () {
  const input = yield* Schema.decodeUnknownEffect(QueryInput)({
    command: positionals[0],
    minutes: Number(values.minutes),
    limit: Number(values.limit),
    level: values.level,
    requestId: values["request-id"],
    traceId: values["trace-id"],
  }).pipe(Effect.mapError(argumentsInvalid));
  if (positionals.length !== 1) return yield* argumentsInvalid();
  const since = Date.now() - input.minutes * 60_000;
  const queries = {
    request: () =>
      input.requestId === undefined
        ? Effect.fail(argumentsInvalid())
        : requestTelemetry(values.app, input.requestId),
    trace: () =>
      input.traceId === undefined
        ? Effect.fail(argumentsInvalid())
        : queryExplorer(
            values.app,
            "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id = ? ORDER BY start_ms LIMIT 2000",
            [input.traceId],
          ),
    traces: () =>
      queryExplorer(
        values.app,
        "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
        [since, input.limit],
      ),
    logs: () =>
      queryExplorer(
        values.app,
        `SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE ts_ms >= ?${input.level ? " AND level = ?" : ""} ORDER BY ts_ms DESC LIMIT ?`,
        input.level ? [since, input.level, input.limit] : [since, input.limit],
      ).pipe(
        Effect.map((logs) =>
          logs.map(({ message, ...row }) => ({
            ...row,
            event: structuredMessage(message) ?? null,
          })),
        ),
      ),
  };
  return { command: input.command, data: yield* queries[input.command]() };
}).pipe(
  Effect.flatMap(({ command, data }) =>
    Effect.sync(() =>
      console.info(
        JSON.stringify({
          ok: true,
          command,
          observedAt: new Date().toISOString(),
          data,
        }),
      ),
    ),
  ),
);

NodeRuntime.runMain(
  (values.help ? help : query).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(
          JSON.stringify({
            ok: false,
            event: "observability.query_failed",
            remediation:
              "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
          }),
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
