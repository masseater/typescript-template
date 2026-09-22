#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, firstUserArgumentIndex, runCli } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

class LocalServicesFailure extends Schema.TaggedError<LocalServicesFailure>()(
  "LocalServicesFailure",
  { code: Schema.Literals(["local_action_unknown", "compose_command_failed"]) },
) {}

const composeFile = new URL("../compose.yaml", import.meta.url).pathname;
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const [requestedAction] = process.argv.slice(firstUserArgumentIndex);
const actions: Readonly<Record<string, readonly string[]>> = {
  config: ["config", "--quiet"],
  logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
  status: ["ps", "--format", "json"],
  up: ["up", "-d", "--wait"],
};

const composeArguments = (
  actionName: string | undefined,
): Effect.Effect<readonly string[], LocalServicesFailure> => {
  const composeArgs =
    actionName === undefined || !Object.hasOwn(actions, actionName)
      ? undefined
      : actions[actionName];
  return composeArgs === undefined
    ? Effect.fail(new LocalServicesFailure({ code: "local_action_unknown" }))
    : Effect.succeed(composeArgs);
};

const runCompose = Effect.fn("runCompose")(function* runCompose(composeArgs: readonly string[]) {
  const filesystem = yield* FileSystem.FileSystem;
  const bundled = yield* filesystem.exists(bundledCompose).pipe(Effect.orElseSucceed(() => false));
  const failed = new LocalServicesFailure({ code: "compose_command_failed" });
  const command = bundled ? bundledCompose : "docker";
  const commandArgs = [...(bundled ? [] : ["compose"]), "-f", composeFile, ...composeArgs];
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner
    .exitCode(
      ChildProcess.make(command, commandArgs, {
        cwd: repositoryRoot,
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
  composeArguments(requestedAction).pipe(
    Effect.flatMap(runCompose),
    Effect.provide(NodeServices.layer),
  ),
  (cause) =>
    causeRecord("local.services_command_failed", {
      cause,
      fields: {
        remediation: "Check the Docker daemon, then retry the requested action.",
      },
    }),
);
