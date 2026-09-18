// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { applicationReadyPaths } from "@repo/config";

import { failure } from "./failure.ts";
import { browserLaunchArguments } from "./lan-gateway.ts";
import { browserConfig, lanOrigin, refreshBrowserConfig, root, run } from "./local-environment.ts";
import type { App } from "./local-environment.ts";

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

const FAILED_EXIT_CODE = 1;

function sessionName(app: App): string {
  return `template-local-${app}`;
}

const sessionArguments = Effect.fn("sessionArguments")(function* sessionArguments(app: App) {
  return [
    "--config",
    fileURLToPath(browserConfig),
    ...(yield* browserLaunchArguments()),
    "--session",
    sessionName(app),
  ];
});

const browser = Effect.fn("browser")(function* browser(app: App) {
  const socketDirectory = yield* refreshBrowserConfig();
  const args = yield* sessionArguments(app);
  // oxlint-disable-next-line node/no-process-env
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  yield* run("agent-browser", [...args, "open", `${lanOrigin(app)}${applicationReadyPaths[app]}`], {
    cwd: root,
    env,
  });
  const report: BrowserReport = {
    event: "local.browser_opened",
    ok: true,
    origin: lanOrigin(app),
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
  const socketDirectory = yield* refreshBrowserConfig();
  const exit = yield* runBrowser([...(yield* sessionArguments(app)), ...args], socketDirectory);
  if (!exit.started) {
    return yield* failure("browser_start_failed");
  }
  if (exit.code !== 0) {
    process.exitCode = exit.code ?? FAILED_EXIT_CODE;
  }
  return exit;
});

export { browser, browserCommand };
