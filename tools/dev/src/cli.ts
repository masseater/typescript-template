import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

import { connection, logs, start, status, stop } from "./applications.ts";
import { browser, browserCommand } from "./browser.ts";
import { failure, reportFailed, type LocalCommandFailure } from "./failure.ts";
import { application, type App } from "./local-environment.ts";
import { setup } from "./setup.ts";
import { storybook } from "./storybook.ts";

const firstUserArgumentIndex = 2;

type Command = Effect.Effect<unknown, LocalCommandFailure>;

const globalCommands = new Map<string, () => Command>([
  ["connect", connection],
  ["setup", setup],
  ["status", status],
  ["storybook", storybook],
]);

const writeReport = (report: unknown): Effect.Effect<void> => {
  return report === undefined ? Effect.void : Console.log(JSON.stringify(report));
};

const appCommands = new Map<string, (app: App, args: readonly string[]) => Command>([
  ["browser", browser],
  ["browser-command", browserCommand],
  ["logs", logs],
  ["start", start],
  ["stop", stop],
]);

const selectCommand = (
  action: string,
  app: string | undefined,
  args: readonly string[],
): Command => {
  const global = globalCommands.get(action);
  if (global !== undefined) {
    return global();
  }
  const scoped = appCommands.get(action);
  return scoped === undefined
    ? Effect.fail(failure("command_unsupported"))
    : application(app).pipe(Effect.flatMap((name) => scoped(name, args)));
};

const [action = "", app, ...args] = process.argv.slice(firstUserArgumentIndex);

NodeRuntime.runMain(
  selectCommand(action, app, args).pipe(
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
