import { causeRecord, reportFailed } from "@repo/cli";
import { APPLICATION, applicationOrigins } from "@repo/config";
import { receiverOrigin } from "@repo/local";
import { TraceId } from "@repo/observability";
import { Cause, Clock, Console, DateTime, Effect, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { queryExplorer, requestTelemetry, withEvent } from "./explorer.ts";
import { exportedTelemetry } from "./exported.ts";

const commands = ["logs", "traces", "trace", "request", "exported"] as const;
type QueryCommand = (typeof commands)[number];

const minutesPerDay = 1440;
const maxQueryLimit = 500;
const millisecondsPerMinute = 60_000;
const defaultLimit = 100;
const defaultMinutes = 15;
const defaultOrigin = `${applicationOrigins[APPLICATION.user]}/`;
const levels = ["debug", "info", "log", "warn", "error"] as const;

const QueryLimit = Schema.Int.check(Schema.isBetween({ maximum: maxQueryLimit, minimum: 1 }));
const QueryMinutes = Schema.Int.check(Schema.isBetween({ maximum: minutesPerDay, minimum: 1 }));

const originFlag = Flag.String("origin").pipe(
  Flag.withDefault(defaultOrigin),
  Flag.withDescription(
    `Loopback origin of the running local app whose Local Explorer is queried, default ${defaultOrigin}`,
  ),
);
const limitFlag = Flag.Int("limit").pipe(
  Flag.withSchema(QueryLimit),
  Flag.withDefault(defaultLimit),
  Flag.withDescription(`Row limit from 1 to ${maxQueryLimit}, default ${defaultLimit}`),
);
const minutesFlag = Flag.Int("minutes").pipe(
  Flag.withSchema(QueryMinutes),
  Flag.withDefault(defaultMinutes),
  Flag.withDescription(
    `Look-back window in minutes from 1 to ${minutesPerDay}, default ${defaultMinutes}`,
  ),
);
const levelFlag = Flag.Literals("level", levels).pipe(
  Flag.optional,
  Flag.withDescription(`Log level to keep, one of ${levels.join(", ")}, default every level`),
);
const traceIdFlag = Flag.String("trace-id").pipe(
  Flag.withSchema(TraceId),
  Flag.withDescription("Trace id of 32 lowercase hexadecimal digits"),
);
const requestIdFlag = Flag.String("request-id").pipe(
  Flag.withDescription("Request id returned in the x-request-id response header"),
);

const remediation = {
  explorer:
    "Check that --origin points at a running local app on a loopback origin. Use --help for the flags of each query.",
  exported:
    "Start the OTLP receiver with `vp run --filter @repo/local up` and check that --trace-id and --minutes cover the exported trace.",
} as const;

const printed = (command: QueryCommand, query: Effect.Effect<unknown, unknown>) =>
  query.pipe(
    Effect.flatMap((data) =>
      DateTime.now.pipe(
        Effect.flatMap((now) =>
          Schema.encodeEffect(
            Schema.fromJsonString(
              Schema.Struct({
                command: Schema.Literals(commands),
                data: Schema.Unknown,
                observedAt: Schema.String,
                ok: Schema.Literal(true),
              }),
            ),
          )({ command, data, observedAt: DateTime.formatIso(now), ok: true }),
        ),
      ),
    ),
    Effect.flatMap((line) => Console.log(line)),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) =>
        reportFailed(
          causeRecord("observability.query_failed", {
            cause,
            fields: {
              remediation: command === "exported" ? remediation.exported : remediation.explorer,
            },
          }),
        ),
    ),
  );

const since = (minutes: number) =>
  Clock.currentTimeMillis.pipe(Effect.map((now) => now - minutes * millisecondsPerMinute));

const logsCommand = Command.make(
  "logs",
  { level: levelFlag, limit: limitFlag, minutes: minutesFlag, origin: originFlag },
  ({ level, limit, minutes, origin }) =>
    printed(
      "logs",
      since(minutes).pipe(
        Effect.flatMap((start) =>
          queryExplorer(
            origin,
            `SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE ts_ms >= ?${Option.isSome(level) ? " AND level = ?" : ""} ORDER BY ts_ms DESC LIMIT ?`,
            [start, ...Option.toArray(level), limit],
          ),
        ),
        Effect.map((rows) => rows.map((row) => withEvent(row))),
      ),
    ),
).pipe(Command.withDescription("Recent structured logs of the local app"));

const tracesCommand = Command.make(
  "traces",
  { limit: limitFlag, minutes: minutesFlag, origin: originFlag },
  ({ limit, minutes, origin }) =>
    printed(
      "traces",
      since(minutes).pipe(
        Effect.flatMap((start) =>
          queryExplorer(
            origin,
            "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
            [start, limit],
          ),
        ),
      ),
    ),
).pipe(Command.withDescription("Recent root spans of the local app"));

const traceCommand = Command.make(
  "trace",
  { origin: originFlag, traceId: traceIdFlag },
  ({ origin, traceId }) =>
    printed(
      "trace",
      queryExplorer(
        origin,
        "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id = ? ORDER BY start_ms LIMIT 2000",
        [traceId],
      ),
    ),
).pipe(Command.withDescription("Every span of one trace in the local app"));

const requestCommand = Command.make(
  "request",
  { origin: originFlag, requestId: requestIdFlag },
  ({ origin, requestId }) => printed("request", requestTelemetry(origin, requestId)),
).pipe(Command.withDescription("The logs and spans correlated with one request id"));

const exportedCommand = Command.make(
  "exported",
  { minutes: minutesFlag, traceId: traceIdFlag },
  ({ minutes, traceId }) =>
    printed(
      "exported",
      exportedTelemetry(
        { logs: receiverOrigin("logs"), traces: receiverOrigin("traces") },
        traceId,
        minutes,
      ),
    ),
).pipe(Command.withDescription("The telemetry of one trace that reached the OTLP receiver"));

const observeCommand = Command.make("observe").pipe(
  Command.withDescription(
    "Read-only queries against the Cloudflare Local Explorer of the running app; exported reads the OTLP receiver of infra/local",
  ),
  Command.withSubcommands([
    logsCommand,
    tracesCommand,
    traceCommand,
    requestCommand,
    exportedCommand,
  ]),
);

export { observeCommand };
