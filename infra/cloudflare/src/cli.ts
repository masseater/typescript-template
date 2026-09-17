import { Effect, Schema } from "effect";
import { reportCause, withVerifiedSecrets } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { parseDeploymentCommand } from "./config.ts";
import { settings } from "./settings.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
import { verifiedSecrets } from "./credentials.ts";

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
    const secrets = yield* verifiedSecrets();
    const { prefix } = yield* withVerifiedSecrets(secrets, settings);
    for (const { stack } of targets) {
      // oxlint-disable-next-line no-console
      console.info(JSON.stringify({ event: "cloudflare.stack_started", stack }));
      const code = yield* runAlchemy([
        operation,
        "--config",
        fileURLToPath(new URL(`${stack}.ts`, import.meta.url)),
        "--stage",
        prefix,
        "--env-file",
        secrets.filename,
      ]);
      if (code !== 0) {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.stack_failed", stack }));
        process.exitCode = code;
        return;
      }
    }
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("cloudflare.command_rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
