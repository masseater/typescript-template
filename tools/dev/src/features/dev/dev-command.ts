import { applications } from "@repo/config";
import { Console, Effect, Option } from "effect";
import { Argument, Command } from "effect/unstable/cli";

import { connection, logs, start, status, stop } from "./applications.ts";
import { authenticate } from "./authenticate.ts";
import { browser, browserCommand } from "./browser.ts";
import { diffCiRunner, writeCiRunner } from "./ci-runner.ts";
import { OriginMode, root, run } from "./local-environment.ts";
import { ensureOperators, operatorExists } from "./operator-account.ts";
import { setup } from "./setup.ts";
import { storybook } from "./storybook.ts";

import type { App } from "./local-environment.ts";

const reported = <E, R>(command: Effect.Effect<unknown, E, R>): Effect.Effect<void, E, R> =>
  command.pipe(
    Effect.flatMap((report) =>
      report === undefined ? Effect.void : Console.log(JSON.stringify(report)),
    ),
  );

const appArgument = Argument.Literals("app", applications).pipe(
  Argument.withDescription("Application the command acts on"),
);

const rootsArgument = Argument.String("root").pipe(
  Argument.variadic({ min: 1 }),
  Argument.withDescription("Runner directories whose .service names the launchd document"),
);

const appCommand = <Name extends string, E, R>(
  name: Name,
  description: string,
  act: (app: App) => Effect.Effect<unknown, E, R>,
) =>
  Command.make(name, { app: appArgument }, ({ app }) => reported(act(app))).pipe(
    Command.withDescription(description),
  );

const operator = Effect.fn("operator")(function* operator() {
  if (!(yield* operatorExists())) {
    yield* run("vp", ["run", "--filter", "@repo/db-local", "db:migrate:local"], { cwd: root });
  }
  yield* ensureOperators();
  return { event: "local.operator_ready", ok: true as const, secretsPrinted: false as const };
});

const devCommand = Command.make("repo-dev").pipe(
  Command.withDescription("Operates the local applications of the repository"),
  Command.withSubcommands([
    appCommand("authenticate", "Signs the operator in through the browser session", (app) =>
      authenticate(app),
    ),
    appCommand("browser", "Opens the application in the browser session", browser),
    Command.make(
      "browser-command",
      {
        app: appArgument,
        browserArgs: Argument.String("agent-browser-argument").pipe(
          Argument.variadic({ min: 1 }),
          Argument.withDescription("Arguments passed to agent-browser in the session"),
        ),
      },
      ({ app, browserArgs }) => reported(browserCommand(app, browserArgs)),
    ).pipe(Command.withDescription("Runs agent-browser inside the application session")),
    Command.make("ci-runner").pipe(
      Command.withDescription("Renders the launchd documents of self-hosted CI runners"),
      Command.withSubcommands([
        Command.make("diff", { roots: rootsArgument }, ({ roots }) =>
          reported(diffCiRunner(roots)),
        ).pipe(Command.withDescription("Reports which documents differ without writing them")),
        Command.make("write", { roots: rootsArgument }, ({ roots }) =>
          reported(writeCiRunner(roots)),
        ).pipe(Command.withDescription("Writes the documents that differ")),
      ]),
    ),
    Command.make("connect", {}, () => reported(connection())).pipe(
      Command.withDescription("Prints the origins of the local applications"),
    ),
    appCommand("logs", "Prints the log of the application", logs),
    Command.make("operator", {}, () => reported(operator())).pipe(
      Command.withDescription("Migrates the local database when needed and provisions operators"),
    ),
    Command.make(
      "setup",
      {
        origins: Argument.Literals("origins", OriginMode.literals).pipe(
          Argument.optional,
          Argument.withDescription("Origins the applications answer on, default the stored mode"),
        ),
      },
      ({ origins }) => reported(setup(Option.getOrUndefined(origins))),
    ).pipe(Command.withDescription("Writes the local configuration of every application")),
    appCommand("start", "Starts the application in the background", start),
    Command.make("status", {}, () => reported(status())).pipe(
      Command.withDescription("Prints whether each application runs and answers"),
    ),
    appCommand("stop", "Stops the application", stop),
    Command.make("storybook", {}, () => reported(storybook())).pipe(
      Command.withDescription("Starts Storybook for the UI library"),
    ),
  ]),
);

export { devCommand };
