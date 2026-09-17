import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { runWithState } from "@template/infra-bootstrap/state";
import { Effect } from "effect";
import { parseDeploymentCommand } from "./config.ts";

NodeRuntime.runMain(
  Effect.gen(function* () {
    const { operation, targets } = yield* parseDeploymentCommand(process.argv.slice(2));
    for (const { stack, dependencies } of targets) {
      console.info(JSON.stringify({ event: "cloudflare.stack_started", stack, dependencies }));
      const code = yield* runWithState([
        operation,
        "--cwd",
        fileURLToPath(new URL(`../${stack}`, import.meta.url)),
      ]);
      if (code !== 0) {
        console.error(JSON.stringify({ event: "cloudflare.stack_failed", stack }));
        process.exitCode = code;
        return;
      }
    }
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "cloudflare.command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
