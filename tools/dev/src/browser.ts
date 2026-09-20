// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { exitWith, markFailed } from "@repo/cli";
import { applicationOrigins, applicationReadyPaths } from "@repo/config";
import { Effect } from "effect";

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
  return ["--config", fileURLToPath(browserConfig), ...launch, "--session", sessionName(app)];
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

function runBrowser(args: readonly string[], socketDirectory: string): Effect.Effect<ChildExit> {
  return Effect.callback<ChildExit>((resume) => {
    const child = spawn("agent-browser", [...args], {
      cwd: root,
      // oxlint-disable-next-line node/no-process-env
      env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory },
      stdio: "inherit",
    });
    child.once("error", () => {
      resume(Effect.succeed({ started: false }));
    });
    child.once("exit", (code) => {
      resume(Effect.succeed({ code, started: true }));
    });
    return Effect.sync(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }
    });
  });
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
