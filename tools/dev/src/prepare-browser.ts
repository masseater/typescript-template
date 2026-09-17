import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, readdir } from "node:fs/promises";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

class PrepareBrowserFailure extends Schema.TaggedError<PrepareBrowserFailure>()(
  "PrepareBrowserFailure",
  { reason: Schema.Literals(["browser_cli_missing", "file_io_failed"]) },
) {}

const EXECUTABLE_MODE = 0o755;

function fileIo<Value>(
  operation: () => Promise<Value>,
): Effect.Effect<Value, PrepareBrowserFailure> {
  return Effect.tryPromise({
    catch: () => new PrepareBrowserFailure({ reason: "file_io_failed" }),
    try: operation,
  });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const directory = yield* Effect.try({
      catch: () => new PrepareBrowserFailure({ reason: "browser_cli_missing" }),
      try: () =>
        path.join(
          path.dirname(createRequire(import.meta.url).resolve("agent-browser/package.json")),
          "bin",
        ),
    });
    for (const name of yield* fileIo(async () => readdir(directory))) {
      if (/^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/u.test(name)) {
        yield* fileIo(async () => chmod(path.join(directory, name), EXECUTABLE_MODE));
      }
    }
    // oxlint-disable-next-line no-console
    console.info(
      JSON.stringify({ event: "local.browser_cli_prepared", globalConfigurationChanged: false }),
    );
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "local.browser_cli_prepare_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
