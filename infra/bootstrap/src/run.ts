import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { fail } from "./config.ts";
import { runWithState } from "./state.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const [command, ...args] = process.argv
      .slice(FIRST_USER_ARGUMENT_INDEX)
      .filter((arg, index) => !(index === 0 && arg === "--"));
    const exitCode =
      command === "pulumi" ? yield* runWithState(args) : yield* fail("only_pulumi_allowed");
    process.exitCode = exitCode;
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "state.command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
