#!/usr/bin/env node
import { parseArgs } from "node:util";

import { causeRecord, runCli } from "@repo/cli";
import { APPLICATION, applicationOrigins } from "@repo/config";
import { receiverOrigin } from "@repo/local";
import { TraceId } from "@repo/observability";
import { Clock, Console, DateTime, Effect, Schema } from "effect";

import { queryExplorer, requestTelemetry, withEvent } from "./explorer.ts";
import { exportedTelemetry } from "./exported.ts";

class QueryFailure extends Schema.TaggedError<QueryFailure>()("QueryFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const commands = ["logs", "traces", "trace", "request", "exported"] as const;
const minutesPerDay = 1440;
const maxQueryLimit = 500;
const millisecondsPerMinute = 60_000;

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
    app: { default: `${applicationOrigins[APPLICATION.user]}/`, type: "string" },
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
  ).pipe(Effect.map((rows) => rows.map((row) => withEvent(row))));
}

function runQuery(app: string, input: Query): Effect.Effect<unknown, unknown> {
  return Effect.gen(function* runQueryProgram() {
    const since = (yield* Clock.currentTimeMillis) - input.minutes * millisecondsPerMinute;
    if (input.command === "request") {
      return yield* required(input.requestId).pipe(
        Effect.flatMap((requestId) => requestTelemetry(app, requestId)),
      );
    }
    if (input.command === "exported") {
      return yield* required(input.traceId).pipe(
        Effect.flatMap((traceId) =>
          exportedTelemetry(
            { logs: receiverOrigin("logs"), traces: receiverOrigin("traces") },
            traceId,
            input.minutes,
          ),
        ),
      );
    }
    if (input.command === "trace") {
      return yield* required(input.traceId).pipe(
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
      return yield* queryExplorer(
        app,
        "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
        [since, input.limit],
      );
    }
    return yield* queryLogs(app, input, since);
  });
}

const help = Console.log(
  JSON.stringify({
    commands,
    flags: ["--app", "--minutes", "--limit", "--level", "--request-id", "--trace-id"],
    readOnly: true,
    sources: {
      default: "Cloudflare Local Explorer of the running app",
      exported: "OTLP receiver of infra/local",
    },
  }),
);

const remediation = {
  explorer:
    "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
  exported:
    "Start the OTLP receiver with `vp run --filter @repo/local up` and check that --trace-id and --minutes cover the exported trace.",
} as const;

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
  const observedAt = DateTime.formatIso(yield* DateTime.now);
  yield* Console.log(
    yield* Schema.encodeEffect(
      Schema.fromJsonString(
        Schema.Struct({
          command: Schema.Literals(commands),
          data: Schema.Unknown,
          observedAt: Schema.String,
          ok: Schema.Literal(true),
        }),
      ),
    )({
      command: input.command,
      data,
      observedAt,
      ok: true,
    }),
  );
  return data;
});

runCli(values.help ? help : query(), (cause) =>
  causeRecord("observability.query_failed", {
    cause,
    fields: {
      remediation: positionals[0] === "exported" ? remediation.exported : remediation.explorer,
    },
  }),
);
