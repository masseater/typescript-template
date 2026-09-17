import { chmod, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

class PrepareBrowserFailure extends Schema.TaggedError<PrepareBrowserFailure>()(
  "PrepareBrowserFailure",
  { reason: Schema.Literals(["browser_cli_missing", "file_io_failed"]) },
) {}

const fileIo = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: () => new PrepareBrowserFailure({ reason: "file_io_failed" }),
  });

NodeRuntime.runMain(
  Effect.gen(function* () {
    const directory = yield* Effect.try({
      try: () =>
        path.join(
          path.dirname(createRequire(import.meta.url).resolve("agent-browser/package.json")),
          "bin",
        ),
      catch: () => new PrepareBrowserFailure({ reason: "browser_cli_missing" }),
    });
    for (const name of yield* fileIo(() => readdir(directory))) {
      if (/^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/.test(name))
        yield* fileIo(() => chmod(path.join(directory, name), 0o755));
    }
    console.info(
      JSON.stringify({ event: "local.browser_cli_prepared", globalConfigurationChanged: false }),
    );
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "local.browser_cli_prepare_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
