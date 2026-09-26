import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Schema } from "effect";
import { Command } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

class LocalServicesFailure extends Schema.TaggedError<LocalServicesFailure>()(
  "LocalServicesFailure",
  { code: Schema.Literals(["compose_command_failed"]) },
) {}

const composeFile = new URL("../../../compose.yaml", import.meta.url).pathname;
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";

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

const composeAction = (name: string, description: string, composeArgs: readonly string[]) =>
  Command.make(name, {}, () => runCompose(composeArgs)).pipe(Command.withDescription(description));

const localCommand = Command.make("repo-local").pipe(
  Command.withDescription("Runs the local services of the repository through Docker Compose"),
  Command.withSubcommands([
    composeAction("config", "Validates the Compose file", ["config", "--quiet"]),
    composeAction("logs", "Prints the last mail catcher log lines", [
      "logs",
      "--no-color",
      "--tail",
      "100",
      "mailpit",
    ]),
    composeAction("status", "Lists the local service containers as JSON", [
      "ps",
      "--format",
      "json",
    ]),
    composeAction("up", "Starts the local services and waits until they are healthy", [
      "up",
      "-d",
      "--wait",
    ]),
  ]),
);

export { LocalServicesFailure, localCommand };
