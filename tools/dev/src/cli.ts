import { Cause, Effect } from "effect";
import { browser, browserCommand } from "./browser.ts";
import { connection, logs, start, status, stop } from "./applications.ts";
import type { App } from "./local-environment.ts";
import type { LocalCommandFailure } from "./failure.ts";
import { NodeRuntime } from "@effect/platform-node";
import { application } from "./local-environment.ts";
import { failure } from "./failure.ts";
import { setup } from "./setup.ts";

type Command = Effect.Effect<unknown, LocalCommandFailure>;

const firstUserArgumentIndex = 2;

const globalCommands = new Map<string, () => Command>([
  ["connect", connection],
  ["setup", setup],
  ["status", status],
]);

const appCommands = new Map<string, (app: App, args: readonly string[]) => Command>([
  ["browser", browser],
  ["browser-command", browserCommand],
  ["logs", logs],
  ["start", start],
  ["stop", stop],
]);

function writeReport(report: unknown): Effect.Effect<void> {
  return Effect.sync(() => {
    if (report !== undefined) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    }
  });
}

function selectCommand(action: string, app: string | undefined, args: readonly string[]): Command {
  const global = globalCommands.get(action);
  if (global !== undefined) {
    return global();
  }
  const scoped = appCommands.get(action);
  return scoped === undefined
    ? Effect.fail(failure("command_unsupported"))
    : application(app).pipe(Effect.flatMap((name) => scoped(name, args)));
}

const [action = "", app, ...args] = process.argv.slice(firstUserArgumentIndex);

NodeRuntime.runMain(
  selectCommand(action, app, args).pipe(
    Effect.flatMap(writeReport),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.sync(() => {
            process.stderr.write(
              `${JSON.stringify({
                event: "local.application_command_failed",
                ok: false,
                remediation:
                  "Check vp run --filter @template/dev setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
              })}\n`,
            );
            process.exitCode = 1;
          }),
    ),
  ),
  { disableErrorReporting: true },
);
