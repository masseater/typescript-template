#!/usr/bin/env node
import { Config, Effect, Schema } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { traceCommand } from "./runner.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const loopbackHosts: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isLoopback(value: string): boolean {
  const url = URL.parse(value);
  return url?.protocol === "http:" && loopbackHosts.has(url.hostname);
}

const LoopbackEndpoint = Schema.String.check(
  Schema.makeFilter(
    (value: string) => isLoopback(value) || "PERF_OTLP_ENDPOINT must be an http URL on loopback",
  ),
);
const endpoint = Config.schema(LoopbackEndpoint, "PERF_OTLP_ENDPOINT").pipe(
  Config.withDefault("http://127.0.0.1:4318"),
  Config.map((value) => value.replace(/\/$/u, "")),
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
