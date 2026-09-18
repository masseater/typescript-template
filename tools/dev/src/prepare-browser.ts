// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";

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

// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

function fileIo<Value>(
  operation: () => Promise<Value>,
): Effect.Effect<Value, PrepareBrowserFailure> {
  return Effect.tryPromise({
    catch: () => new PrepareBrowserFailure({ reason: "file_io_failed" }),
    try: operation,
  });
}

function packageDirectory(
  specifier: string,
  reason: "browser_cli_missing" | "playwright_cli_missing",
): Effect.Effect<string, PrepareBrowserFailure> {
  return Effect.try({
    catch: () => new PrepareBrowserFailure({ reason }),
    try: () => path.dirname(require.resolve(`${specifier}/package.json`)),
  });
}

const prepareAgentBrowser = Effect.fn("prepareAgentBrowser")(function* prepareAgentBrowser() {
  const directory = path.join(
    yield* packageDirectory("agent-browser", "browser_cli_missing"),
    "bin",
  );
  for (const name of yield* fileIo(async () => readdir(directory))) {
    if (/^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/u.test(name)) {
      yield* fileIo(async () => chmod(path.join(directory, name), EXECUTABLE_MODE));
    }
  }
});

const preparePlaywright = Effect.fn("preparePlaywright")(function* preparePlaywright() {
  const cli = path.join(yield* packageDirectory("playwright", "playwright_cli_missing"), "cli.js");
  const { stdout } = yield* Effect.tryPromise({
    catch: () => new PrepareBrowserFailure({ reason: "playwright_install_failed" }),
    try: async () => execFileAsync(process.execPath, [cli, "install", PLAYWRIGHT_BROWSER]),
  });
  if (!Schema.is(Schema.String)(stdout)) {
    return yield* new PrepareBrowserFailure({ reason: "playwright_install_failed" });
  }
});

runCli(
  Effect.gen(function* program() {
    yield* prepareAgentBrowser();
    yield* preparePlaywright();
    yield* Console.info(
      JSON.stringify({
        event: "local.browser_cli_prepared",
        globalConfigurationChanged: false,
        playwrightBrowser: PLAYWRIGHT_BROWSER,
      }),
    );
  }),
  { event: "local.browser_cli_prepare_failed" },
);
