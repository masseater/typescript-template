import { Application, EnvironmentUnusable, writeLoopbackVariables } from "./environment.ts";
import { Effect, Schema } from "effect";
import { NodeRuntime } from "@effect/platform-node";

const firstUserArgumentIndex = 2;
const usage = "vp run --filter @template/load environment <user|admin|wiki>";

NodeRuntime.runMain(
  Schema.decodeUnknownEffect(Application)(process.argv[firstUserArgumentIndex]).pipe(
    Effect.mapError(() => new EnvironmentUnusable({ reason: "origin_mismatch" })),
    Effect.flatMap(writeLoopbackVariables),
    Effect.flatMap((origin) =>
      Effect.sync(() => {
        process.stdout.write(
          `${JSON.stringify({ event: "load.environment_ready", ok: true, origin })}\n`,
        );
      }),
    ),
    Effect.catchTag("EnvironmentUnusable", (failure) =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({ event: "load.environment_failed", ok: false, reason: failure.reason, usage })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
