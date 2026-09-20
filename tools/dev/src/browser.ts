import { exitWith, markFailed } from "@repo/cli";
import { applicationOrigins, applicationReadyPaths } from "@repo/config";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { failure } from "./failure.ts";
import { browserLaunchArguments } from "./lan-gateway.ts";
import {
  browserConfig,
  lanOrigin,
  readCredentials,
  refreshBrowserConfig,
  root,
  run,
} from "./local-environment.ts";
import { urlPath } from "./platform.ts";

import type { App, Credentials } from "./local-environment.ts";

interface BrowserReport {
  readonly event: "local.browser_opened";
  readonly ok: true;
  readonly origin: string;
  readonly secretsPrinted: false;
  readonly session: string;
}

type ChildExit =
  | { readonly started: false }
  | { readonly started: true; readonly code: number | null };

function sessionName(app: App): string {
  return `template-local-${app}`;
}

function configuredOrigin(app: App, credentials: Credentials): string {
  return credentials.origins === "loopback" ? applicationOrigins[app] : lanOrigin(app);
}

const sessionArguments = Effect.fn("sessionArguments")(function* sessionArguments(
  app: App,
  credentials: Credentials,
) {
  const launch =
    credentials.origins === "loopback" ? ([] as const) : yield* browserLaunchArguments();
  const config = yield* urlPath(browserConfig);
  return ["--config", config, ...launch, "--session", sessionName(app)];
});

const browser = Effect.fn("browser")(function* browser(app: App) {
  const credentials = yield* readCredentials();
  const socketDirectory = yield* refreshBrowserConfig();
  const args = yield* sessionArguments(app, credentials);
  const origin = configuredOrigin(app, credentials);
  // oxlint-disable-next-line node/no-process-env
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  yield* run("agent-browser", [...args, "open", `${origin}${applicationReadyPaths[app]}`], {
    cwd: root,
    env,
  });
  const report: BrowserReport = {
    event: "local.browser_opened",
    ok: true,
    origin,
    secretsPrinted: false,
    session: sessionName(app),
  };
  return report;
});

function runBrowser(
  args: readonly string[],
  socketDirectory: string,
): Effect.Effect<ChildExit, never, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* runBrowserProgram() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner
      .spawn(
        ChildProcess.make("agent-browser", [...args], {
          cwd: root,
          env: { AGENT_BROWSER_SOCKET_DIR: socketDirectory },
          extendEnv: true,
          stderr: "inherit",
          stdin: "inherit",
          stdout: "inherit",
        }),
      )
      .pipe(Effect.catch(() => Effect.succeed(undefined)));
    if (handle === undefined) {
      return { started: false };
    }
    const exitCode = yield* handle.exitCode.pipe(Effect.catch(() => Effect.succeed(null)));
    return { code: exitCode === null ? null : Number(exitCode), started: true };
  }).pipe(Effect.scoped);
}

const browserCommand = Effect.fn("browserCommand")(function* browserCommand(
  app: App,
  args: readonly string[],
) {
  if (args.length === 0) {
    return yield* failure("browser_command_required");
  }
  const credentials = yield* readCredentials();
  const socketDirectory = yield* refreshBrowserConfig();
  const exit = yield* runBrowser(
    [...(yield* sessionArguments(app, credentials)), ...args],
    socketDirectory,
  );
  if (!exit.started) {
    return yield* failure("browser_start_failed");
  }
  if (exit.code !== 0) {
    yield* exit.code === null ? markFailed : exitWith(exit.code);
  }
  return exit;
});

export { browser, browserCommand };
