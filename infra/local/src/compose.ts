// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { constants } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { access } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { causeRecord, runCli } from "@repo/cli";
import { Effect, Schema } from "effect";

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
  const bundled = yield* Effect.promise(async () =>
    access(bundledCompose, constants.X_OK).then(
      () => true,
      () => false,
    ),
  );
  const failed = new LocalServicesFailure({ code: "compose_command_failed" });
  return yield* Effect.callback<undefined, LocalServicesFailure>((resume) => {
    const child = spawn(
      bundled ? bundledCompose : "docker",
      [...(bundled ? [] : ["compose"]), "-f", composeFile, ...args],
      { cwd: root, stdio: "inherit" },
    );
    child.once("error", () => {
      resume(Effect.fail(failed));
    });
    child.once("exit", (code) => {
      resume(code === 0 ? Effect.undefined : Effect.fail(failed));
    });
  });
});

runCli(composeArguments(action).pipe(Effect.flatMap(runCompose)), (cause) =>
  causeRecord("local.services_command_failed", cause, {
    remediation: "Check the Docker daemon, then retry the requested action.",
  }),
);
