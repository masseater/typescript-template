import { Effect, Schema } from "effect";
import { readOwnerOnlySecretsFile, secretsFile } from "./credentials.ts";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { parseDeploymentCommand } from "./config.ts";
import { projectName } from "./project.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
import { stage } from "./stacks.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const FAILED_EXIT_CODE = 1;

class AlchemyFailure extends Schema.TaggedError<AlchemyFailure>()("AlchemyFailure", {
  code: Schema.Literal("alchemy_command_failed"),
}) {}

const alchemyBinary = fileURLToPath(new URL("../node_modules/.bin/alchemy", import.meta.url));

function runAlchemy(args: readonly string[]): Effect.Effect<number, AlchemyFailure> {
  return Effect.callback<number, AlchemyFailure>((resume) => {
    const child = spawn(alchemyBinary, [...args], { shell: false, stdio: "inherit" });
    child.on("error", () => {
      resume(Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" })));
    });
    child.on("exit", (code) => {
      resume(Effect.succeed(code ?? FAILED_EXIT_CODE));
    });
  });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { operation, targets } = yield* parseDeploymentCommand(
      process.argv.slice(FIRST_USER_ARGUMENT_INDEX),
    );
    const envFile = yield* readOwnerOnlySecretsFile(secretsFile(yield* projectName));
    for (const { stack, dependencies } of targets) {
      // oxlint-disable-next-line no-console
      console.info(JSON.stringify({ dependencies, event: "cloudflare.stack_started", stack }));
      const code = yield* runAlchemy([
        operation,
        "--config",
        fileURLToPath(new URL(`${stack}.ts`, import.meta.url)),
        "--stage",
        stage,
        "--env-file",
        envFile,
      ]);
      if (code !== 0) {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.stack_failed", stack }));
        process.exitCode = code;
        return;
      }
    }
  }).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("SecretsFileFailure", (failure) =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(
          JSON.stringify({
            code: failure.code,
            event: "cloudflare.secrets_rejected",
            missingKeys: failure.keys,
          }),
        );
        process.exitCode = FAILED_EXIT_CODE;
      }),
    ),
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.command_failed" }));
        process.exitCode = FAILED_EXIT_CODE;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
