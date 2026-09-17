import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { parseDeploymentCommand } from "./config.ts";
import { runWithState } from "@template/infra-bootstrap/state";

const FIRST_USER_ARGUMENT_INDEX = 2;

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { operation, targets } = yield* parseDeploymentCommand(
      process.argv.slice(FIRST_USER_ARGUMENT_INDEX),
    );
    for (const { stack, dependencies } of targets) {
      // oxlint-disable-next-line no-console
      console.info(JSON.stringify({ dependencies, event: "cloudflare.stack_started", stack }));
      const code = yield* runWithState([
        operation,
        "--cwd",
        fileURLToPath(new URL(`../${stack}`, import.meta.url)),
      ]);
      if (code !== 0) {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.stack_failed", stack }));
        process.exitCode = code;
        return;
      }
    }
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "cloudflare.command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
