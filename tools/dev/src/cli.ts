import { causeRecord, runCli } from "@repo/config/cli";
import { Console, Effect } from "effect";

import { connection, logs, start, status, stop } from "./applications.ts";
import { authenticate } from "./authenticate.ts";
import { browser, browserCommand } from "./browser.ts";
import { ciRunner } from "./ci-runner.ts";
import { failure } from "./failure.ts";
import { application, root, run } from "./local-environment.ts";
import { ensureOperator, operatorExists } from "./operator-account.ts";
import { setup } from "./setup.ts";
import { storybook } from "./storybook.ts";

import type { LocalCommandFailure } from "./failure.ts";
import type { App } from "./local-environment.ts";

type Command = Effect.Effect<unknown, LocalCommandFailure>;

const firstUserArgumentIndex = 2;

const operator = Effect.fn("operator")(function* operator(_args: readonly string[]) {
  if (!(yield* operatorExists())) {
    yield* run("vp", ["run", "--filter", "@repo/db", "db:migrate:local"], { cwd: root });
  }
  yield* ensureOperator();
  return { event: "local.operator_ready", ok: true as const, secretsPrinted: false as const };
});

const globalCommands = new Map<string, (args: readonly string[]) => Command>([
  ["ci-runner", ciRunner],
  ["connect", connection],
  ["operator", operator as (args: readonly string[]) => Command],
  ["setup", setup],
  ["status", status],
  ["storybook", storybook],
]);

const appCommands = new Map<string, (app: App, args: readonly string[]) => Command>([
  ["authenticate", authenticate as (app: App, args: readonly string[]) => Command],
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

runCli(
  selectCommand(action, args).pipe(Effect.flatMap(writeReport)) as Effect.Effect<
    unknown,
    LocalCommandFailure
  >,
  (cause) =>
    causeRecord("local.application_command_failed", cause, {
      remediation:
        "Check vp run --filter @repo/dev setup, vp run --filter @repo/db db:migrate:local, vp run --filter @repo/dev operator, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
    }),
);
