import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

class LocalServicesFailure extends Schema.TaggedError<LocalServicesFailure>()(
  "LocalServicesFailure",
  { code: Schema.Literals(["local_action_unknown", "compose_command_failed"]) },
) {}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const actions: Record<string, readonly string[]> = {
  config: ["config", "--quiet"],
  up: ["up", "-d", "--wait"],
  status: ["ps", "--format", "json"],
  logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
};

NodeRuntime.runMain(
  Effect.gen(function* () {
    const action = process.argv[2];
    const args = action && Object.hasOwn(actions, action) ? actions[action] : undefined;
    if (!args) return yield* new LocalServicesFailure({ code: "local_action_unknown" });
    const bundled = yield* Effect.promise(() =>
      access(bundledCompose, constants.X_OK).then(
        () => true,
        () => false,
      ),
    );
    yield* Effect.callback<void, LocalServicesFailure>((resume) => {
      const child = spawn(
        bundled ? bundledCompose : "docker",
        [...(bundled ? [] : ["compose"]), "-f", composeFile, ...args],
        { cwd: root, stdio: "inherit" },
      );
      const failed = new LocalServicesFailure({ code: "compose_command_failed" });
      child.once("error", () => resume(Effect.fail(failed)));
      child.once("exit", (code) => resume(code === 0 ? Effect.void : Effect.fail(failed)));
    });
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(
          JSON.stringify({
            ok: false,
            event: "local.services_command_failed",
            remediation: "Check the Docker daemon, then retry the requested action.",
          }),
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
