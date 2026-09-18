import { Effect, Option, Schema } from "effect";
import { TempoTrace, measure, summarize } from "./analysis.ts";
import { NodeRuntime } from "@effect/platform-node";
import type { RunMeasurement } from "./analysis.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

class ReportFailure extends Schema.TaggedError<ReportFailure>()("ReportFailure", {
  reason: Schema.Literals(["query_failed", "response_invalid"]),
}) {}

const FoundTrace = Schema.Struct({ traceID: Schema.String });
const TempoSearch = Schema.Struct({ traces: Schema.optionalKey(Schema.Array(FoundTrace)) });

const QUERY_TIMEOUT_MILLISECONDS = 15_000;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const FETCH_CONCURRENCY = 8;

const { values } = parseArgs({
  options: {
    command: { type: "string" },
    hours: { default: "24", type: "string" },
    limit: { default: "50", type: "string" },
    tempo: { default: "http://127.0.0.1:3200", type: "string" },
  },
});

const tempoJson = Effect.fn("tempoJson")(function* tempoJson(path: string) {
  const response = yield* Effect.tryPromise({
    catch: () => new ReportFailure({ reason: "query_failed" }),
    try: async (signal) =>
      fetch(new URL(path, values.tempo), {
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(QUERY_TIMEOUT_MILLISECONDS)]),
      }),
  });
  if (!response.ok) {
    return yield* Effect.fail(new ReportFailure({ reason: "query_failed" }));
  }
  return yield* Effect.tryPromise({
    catch: () => new ReportFailure({ reason: "response_invalid" }),
    try: async (): Promise<unknown> => response.json(),
  });
});

function traceQuery(command: string | undefined): string {
  const root = 'trace:rootService = "vp"';
  return command === undefined
    ? `{ ${root} }`
    : `{ ${root} && trace:rootName = ${JSON.stringify(command)} }`;
}

function searchPath(): string {
  const end = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const search = new URLSearchParams();
  search.set("q", traceQuery(values.command));
  search.set("start", String(end - Number(values.hours) * SECONDS_PER_HOUR));
  search.set("end", String(end));
  search.set("limit", values.limit);
  return `/api/search?${search.toString()}`;
}

function measuredTrace(traceId: string): Effect.Effect<readonly RunMeasurement[], ReportFailure> {
  return tempoJson(`/api/v2/traces/${traceId}`).pipe(
    Effect.map((json) => Schema.decodeUnknownOption(TempoTrace)(json)),
    Effect.map((trace) =>
      Option.toArray(trace).flatMap((decoded) => {
        const run = measure(traceId, decoded);
        return run === undefined ? [] : [run];
      }),
    ),
  );
}

const report = Effect.gen(function* report() {
  const found = yield* tempoJson(searchPath()).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(TempoSearch)),
    Effect.mapError(() => new ReportFailure({ reason: "response_invalid" })),
  );
  const measurements = yield* Effect.forEach(
    found.traces ?? [],
    ({ traceID }) => measuredTrace(traceID),
    { concurrency: FETCH_CONCURRENCY },
  );
  const groups = summarize(measurements.flat());
  process.stdout.write(`${JSON.stringify({ event: "perf.report", groups, ok: true })}\n`);
});

NodeRuntime.runMain(
  report.pipe(
    Effect.catchTag("ReportFailure", (failure) =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({ event: "perf.report_failed", ok: false, reason: failure.reason, tempo: values.tempo })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
