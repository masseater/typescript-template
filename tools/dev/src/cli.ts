#!/usr/bin/env node
import { causeRecord, firstUserArgumentIndex, runCli } from "@repo/cli";
import { ADMIN_PERMISSION } from "@repo/config/identity";
import { Console, Effect } from "effect";

import { connection, logs, start, status, stop } from "./applications.ts";
import { authenticate } from "./authenticate.ts";
import { browser, browserCommand } from "./browser.ts";
import { ciRunner } from "./ci-runner.ts";
import { failure } from "./failure.ts";
import { application, root, run } from "./local-environment.ts";
import { ensureOperators, operatorExists } from "./operator-account.ts";
import { layer } from "./platform.ts";
import { setup } from "./setup.ts";
import { storybook } from "./storybook.ts";

import type { LocalCommandFailure } from "./failure.ts";
import type { App } from "./local-environment.ts";
import type { DevServices } from "./platform.ts";

type Command = Effect.Effect<unknown, LocalCommandFailure, DevServices>;

const operator = Effect.fn("operator")(function* operator(_args: readonly string[]) {
  if (!(yield* operatorExists())) {
    yield* run("vp", ["run", "--filter", "@repo/db-local", "db:migrate:local"], { cwd: root });
  }
  yield* ensureOperators();
  return { event: "local.operator_ready", ok: true as const, secretsPrinted: false as const };
});

const globalCommands = new Map<string, (args: readonly string[]) => Command>([
  ["ci-runner", ciRunner],
  ["connect", connection],
  [ADMIN_PERMISSION.operator, operator as (args: readonly string[]) => Command],
  ["setup", setup],
  ["status", status],
  ["storybook", (_args) => storybook()],
]);

const appCommands = new Map<string, (app: App, args: readonly string[]) => Command>([
  ["authenticate", authenticate as (app: App, args: readonly string[]) => Command],
  ["browser", browser],
  ["browser-command", browserCommand],
  ["logs", logs],
  ["start", start as (app: App, args: readonly string[]) => Command],
  ["stop", stop as (app: App, args: readonly string[]) => Command],
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
  selectCommand(action, args).pipe(Effect.flatMap(writeReport), Effect.provide(layer)),
  (cause) =>
    causeRecord("local.application_command_failed", {
      cause,
      fields: {
        remediation:
          "Check vp run --filter @repo/dev setup, vp run --filter @repo/db-local db:migrate:local, vp run --filter @repo/dev operator, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
      },
    }),
);
