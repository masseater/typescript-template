#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import { causeRecord, firstUserArgumentIndex, runCli } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, Schema } from "effect";

class LocalServicesFailure extends Schema.TaggedError<LocalServicesFailure>()(
  "LocalServicesFailure",
  { code: Schema.Literals(["local_action_unknown", "compose_command_failed"]) },
) {}

const composeFile = join(import.meta.dirname, "../compose.yaml");
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const [action] = process.argv.slice(firstUserArgumentIndex);
const actions: Readonly<Record<string, readonly string[]>> = {
  config: ["config", "--quiet"],
  logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
  status: ["ps", "--format", "json"],
  up: ["up", "-d", "--wait"],
};

const composeArguments = function composeArguments(
  actionName: string | undefined,
): Effect.Effect<readonly string[], LocalServicesFailure> {
  const composeArgs =
    actionName === undefined || !Object.hasOwn(actions, actionName)
      ? undefined
      : actions[actionName];
  return composeArgs === undefined
    ? Effect.fail(new LocalServicesFailure({ code: "local_action_unknown" }))
    : Effect.succeed(composeArgs);
};

const bundledComposeAvailable = Effect.tryPromise({
  try: async () => {
    await access(bundledCompose, constants.X_OK);
    return true;
  },
  catch: () => false,
});

const waitForComposeExit = (
  bundled: boolean,
  composeArgs: readonly string[],
): Promise<number | null> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      bundled ? bundledCompose : "docker",
      [...(bundled ? [] : ["compose"]), "-f", composeFile, ...composeArgs],
      { cwd: repositoryRoot, stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", resolve);
  });

const runCompose = Effect.fn("runCompose")(function* runCompose(composeArgs: readonly string[]) {
  const bundled = yield* bundledComposeAvailable;
  const exitCode = yield* Effect.tryPromise({
    try: () => waitForComposeExit(bundled, composeArgs),
    catch: () => new LocalServicesFailure({ code: "compose_command_failed" }),
  });
  if (exitCode !== 0) {
    return yield* Effect.fail(new LocalServicesFailure({ code: "compose_command_failed" }));
  }
});

runCli(composeArguments(action).pipe(Effect.flatMap(runCompose)), (cause) =>
  causeRecord("local.services_command_failed", {
    cause,
    fields: {
      remediation: "Check the Docker daemon, then retry the requested action.",
    },
  }),
);
