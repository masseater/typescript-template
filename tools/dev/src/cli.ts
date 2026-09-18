import { Cause, Console, Effect } from "effect";
import { browser, browserCommand } from "./browser.ts";
import { connection, logs, start, status, stop } from "./applications.ts";
import { failure, reportFailed } from "./failure.ts";
import type { App } from "./local-environment.ts";
import type { LocalCommandFailure } from "./failure.ts";
import { NodeRuntime } from "@effect/platform-node";
import { application } from "./local-environment.ts";
import { setup } from "./setup.ts";
import { storybook } from "./storybook.ts";

type Command = Effect.Effect<unknown, LocalCommandFailure>;

const firstUserArgumentIndex = 2;

const globalCommands = new Map<string, (args: readonly string[]) => Command>([
  ["connect", connection],
  ["setup", setup],
  ["status", status],
  ["storybook", storybook],
]);

const appCommands = new Map<string, (app: App, args: readonly string[]) => Command>([
  ["browser", browser],
  ["browser-command", browserCommand],
  ["logs", logs],
  ["start", start],
  ["stop", stop],
]);

function writeReport(report: unknown): Effect.Effect<void> {
  return report === undefined ? Effect.void : Console.log(JSON.stringify(report));
}

function selectCommand(action: string, args: readonly string[]): Command {
  const global = globalCommands.get(action);
  if (global !== undefined) {
    return global(args);
  }
  const scoped = appCommands.get(action);
  const [app, ...rest] = args;
  return scoped === undefined
    ? Effect.fail(failure("command_unsupported"))
    : application(app).pipe(Effect.flatMap((name) => scoped(name, rest)));
}

const [action = "", ...args] = process.argv.slice(firstUserArgumentIndex);

NodeRuntime.runMain(
  selectCommand(action, args).pipe(
    Effect.flatMap(writeReport),
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : reportFailed({
            event: "local.application_command_failed",
            ok: false,
            remediation:
              "Check vp run --filter @template/dev setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
          }),
    ),
  ),
  { disableErrorReporting: true },
);
