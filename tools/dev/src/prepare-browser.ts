#!/usr/bin/env node
import { causeRecord, runCli } from "@repo/cli";
import { Console, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { layer } from "./platform.ts";

class PrepareBrowserFailure extends Schema.TaggedError<PrepareBrowserFailure>()(
  "PrepareBrowserFailure",
  {
    reason: Schema.Literals([
      "browser_cli_missing",
      "file_io_failed",
      "playwright_cli_missing",
      "playwright_install_failed",
    ]),
  },
) {}

const EXECUTABLE_MODE = 0o755;
const PLAYWRIGHT_BROWSER = "chromium";

function resolvePackageDirectory(
  path: Path.Path,
  specifier: string,
  reason: "browser_cli_missing" | "playwright_cli_missing",
): Effect.Effect<string, PrepareBrowserFailure> {
  return Effect.try({
    catch: () => new PrepareBrowserFailure({ reason }),
    try: () => new URL(import.meta.resolve(`${specifier}/package.json`)),
  }).pipe(
    Effect.flatMap((url) =>
      path.fromFileUrl(url).pipe(
        Effect.map((resolved) => path.dirname(resolved)),
        Effect.mapError(() => new PrepareBrowserFailure({ reason })),
      ),
    ),
  );
}

const program = Effect.gen(function* prepareBrowser() {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const agentDirectory = path.join(
    yield* resolvePackageDirectory(path, "agent-browser", "browser_cli_missing"),
    "bin",
  );
  for (const name of yield* fs
    .readDirectory(agentDirectory)
    .pipe(Effect.mapError(() => new PrepareBrowserFailure({ reason: "file_io_failed" })))) {
    if (/^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/u.test(name)) {
      yield* fs
        .chmod(path.join(agentDirectory, name), EXECUTABLE_MODE)
        .pipe(Effect.mapError(() => new PrepareBrowserFailure({ reason: "file_io_failed" })));
    }
  }
  const cli = path.join(
    yield* resolvePackageDirectory(path, "playwright", "playwright_cli_missing"),
    "cli.js",
  );
  yield* Effect.gen(function* installPlaywright() {
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(process.execPath, [cli, "install", PLAYWRIGHT_BROWSER], {
          extendEnv: true,
          stderr: "pipe",
          stdin: "ignore",
          stdout: "pipe",
        }),
      )
      .pipe(
        Effect.mapError(() => new PrepareBrowserFailure({ reason: "playwright_install_failed" })),
      );
    const stdout = yield* Stream.mkString(Stream.decodeText(handle.stdout)).pipe(
      Effect.mapError(() => new PrepareBrowserFailure({ reason: "playwright_install_failed" })),
    );
    if (!Schema.is(Schema.String)(stdout)) {
      return yield* new PrepareBrowserFailure({ reason: "playwright_install_failed" });
    }
  }).pipe(Effect.scoped);
  yield* Console.info(
    JSON.stringify({
      event: "local.browser_cli_prepared",
      globalConfigurationChanged: false,
      playwrightBrowser: PLAYWRIGHT_BROWSER,
    }),
  );
}).pipe(Effect.scoped, Effect.provide(layer));

runCli(program, (cause) => causeRecord("local.browser_cli_prepare_failed", { cause }));
