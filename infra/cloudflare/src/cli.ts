import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { runWithState } from "@template/infra-bootstrap/state";
import { Effect } from "effect";
import { parseDeploymentCommand } from "./config.ts";

NodeRuntime.runMain(
  Effect.gen(function* () {
    const { operation, target } = yield* parseDeploymentCommand(process.argv.slice(2));
    const exitCode = yield* runWithState([
      operation,
      "--cwd",
      fileURLToPath(new URL(`../${target}`, import.meta.url)),
    ]);
    process.exitCode = exitCode;
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
