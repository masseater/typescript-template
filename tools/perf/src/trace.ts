import { Config, Effect, Schema } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { traceCommand } from "./runner.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const endpoint = Config.schema(Schema.String, "OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
  Config.withDefault("http://127.0.0.1:4318"),
);

const main = Effect.gen(function* main() {
  const exitCode = yield* traceCommand(process.argv.slice(FIRST_USER_ARGUMENT_INDEX), {
    endpoint: yield* endpoint,
    // oxlint-disable-next-line node/no-process-env
    environment: process.env,
  });
  process.exitCode = exitCode;
});

NodeRuntime.runMain(
  main.pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({ event: "perf.trace_failed", failure: String(cause), ok: false })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
