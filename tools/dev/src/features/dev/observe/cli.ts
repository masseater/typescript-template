#!/usr/bin/env node
import { causeRecord, reportFailed, runCli } from "@repo/cli";
import { APPLICATION, applicationOrigins } from "@repo/config";
import { receiverOrigin } from "@repo/local";
import { TraceId } from "@repo/observability";
import { Cause, Clock, Console, DateTime, Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { layer } from "../platform.ts";
import { queryExplorer, requestTelemetry, withEvent } from "./explorer.ts";
import { exportedTelemetry } from "./exported.ts";

class QueryFailure extends Schema.TaggedError<QueryFailure>()("QueryFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const commands = ["logs", "traces", "trace", "request", "exported"] as const;
const minutesPerDay = 1440;
const maxQueryLimit = 500;
const millisecondsPerMinute = 60_000;
const defaultLimit = "100";
const defaultMinutes = "15";
const defaultApp = `${applicationOrigins[APPLICATION.user]}/`;

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

const remediation = {
  explorer:
    "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
  exported:
    "Start the OTLP receiver with `vp run --filter @repo/local up` and check that --trace-id and --minutes cover the exported trace.",
} as const;

function queryFailure(
  cause: Cause.Cause<unknown>,
  command: string | undefined,
): Readonly<Record<string, unknown>> {
  return causeRecord("observability.query_failed", {
    cause,
    fields: {
      remediation: command === "exported" ? remediation.exported : remediation.explorer,
    },
  });
}

interface QueryArguments {
  readonly app: string;
  readonly level: Option.Option<string>;
  readonly limit: string;
  readonly minutes: string;
  readonly positionals: readonly string[];
  readonly requestId: Option.Option<string>;
  readonly traceId: Option.Option<string>;
}

const query = Effect.fn("query")(function* query(parsed: QueryArguments) {
  const input = yield* Schema.decodeUnknownEffect(QueryInput)({
    command: parsed.positionals[0],
    level: Option.getOrUndefined(parsed.level),
    limit: Number(parsed.limit),
    minutes: Number(parsed.minutes),
    requestId: Option.getOrUndefined(parsed.requestId),
    traceId: Option.getOrUndefined(parsed.traceId),
  }).pipe(Effect.mapError(argumentsInvalid));
  if (parsed.positionals.length !== 1) {
    return yield* argumentsInvalid();
  }
  const data = yield* runQuery(parsed.app, input);
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

const observeCommand = Command.make(
  "observe",
  {
    app: Flag.String("app").pipe(
      Flag.withDefault(defaultApp),
      Flag.withDescription(
        `Origin of the running local app whose Local Explorer is queried, default ${defaultApp}`,
      ),
    ),
    level: Flag.String("level").pipe(Flag.optional, Flag.withDescription("Log level filter")),
    limit: Flag.String("limit").pipe(
      Flag.withDefault(defaultLimit),
      Flag.withDescription(`Row limit from 1 to ${maxQueryLimit}, default ${defaultLimit}`),
    ),
    minutes: Flag.String("minutes").pipe(
      Flag.withDefault(defaultMinutes),
      Flag.withDescription(
        `Look-back window in minutes from 1 to ${minutesPerDay}, default ${defaultMinutes}`,
      ),
    ),
    positionals: Argument.variadic(Argument.String("command")).pipe(
      Argument.withDescription(commands.join(" | ")),
    ),
    requestId: Flag.String("request-id").pipe(
      Flag.optional,
      Flag.withDescription("Request id for the request command"),
    ),
    traceId: Flag.String("trace-id").pipe(
      Flag.optional,
      Flag.withDescription("Trace id for the trace and exported commands"),
    ),
  },
  (parsed) =>
    query(parsed).pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => reportFailed(queryFailure(cause, parsed.positionals[0])),
      ),
    ),
).pipe(
  Command.withDescription(
    "Read-only queries against the Cloudflare Local Explorer of the running app; exported reads the OTLP receiver of infra/local",
  ),
  Command.run({ version: "0.0.0" }),
  Effect.provide(layer),
);

runCli(observeCommand, (cause) => queryFailure(cause, undefined));
