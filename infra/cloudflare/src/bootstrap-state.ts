import { Effect, Schema } from "effect";
import { reportCause, withVerifiedSecrets } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { settings } from "./settings.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
import { verifiedSecrets } from "./credentials.ts";

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
    const secrets = yield* verifiedSecrets();
    yield* withVerifiedSecrets(secrets, settings);
    const code = yield* runAlchemy([
      "provider",
      "cloudflare",
      "bootstrap",
      "--env-file",
      secrets.filename,
    ]);
    if (code !== 0) {
      return yield* Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" }));
    }
    // oxlint-disable-next-line no-console
    console.info(JSON.stringify({ event: "cloudflare.state_store_bootstrapped" }));
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("cloudflare.state_store_rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
