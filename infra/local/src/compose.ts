#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { Effect, FileSystem, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const FIRST_USER_ARGUMENT_INDEX = 2;

class LocalServicesFailure extends Schema.TaggedError<LocalServicesFailure>()(
  "LocalServicesFailure",
  { code: Schema.Literals(["local_action_unknown", "compose_command_failed"]) },
) {}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const [action] = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
const actions: Readonly<Record<string, readonly string[]>> = {
  config: ["config", "--quiet"],
  logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
  status: ["ps", "--format", "json"],
  up: ["up", "-d", "--wait"],
};

function composeArguments(
  name: string | undefined,
): Effect.Effect<readonly string[], LocalServicesFailure> {
  const args = name === undefined || !Object.hasOwn(actions, name) ? undefined : actions[name];
  return args === undefined
    ? Effect.fail(new LocalServicesFailure({ code: "local_action_unknown" }))
    : Effect.succeed(args);
}

const runCompose = Effect.fn("runCompose")(function* runCompose(args: readonly string[]) {
  const filesystem = yield* FileSystem.FileSystem;
  const bundled = yield* filesystem.exists(bundledCompose).pipe(Effect.orElseSucceed(() => false));
  const failed = new LocalServicesFailure({ code: "compose_command_failed" });
  const command = bundled ? bundledCompose : "docker";
  const commandArgs = [...(bundled ? [] : ["compose"]), "-f", composeFile, ...args];
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner
    .exitCode(
      ChildProcess.make(command, commandArgs, {
        cwd: root,
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      }),
    )
    .pipe(Effect.mapError(() => failed));
  if (exitCode !== 0) {
    return yield* failed;
  }
});

runCli(
  composeArguments(action).pipe(Effect.flatMap(runCompose), Effect.provide(NodeServices.layer)),
  (cause) =>
    causeRecord("local.services_command_failed", {
      cause,
      fields: {
        remediation: "Check the Docker daemon, then retry the requested action.",
      },
    }),
);
