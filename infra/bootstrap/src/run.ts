import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { fail } from "./config.ts";
import { runWithState } from "./state.ts";

NodeRuntime.runMain(
  Effect.gen(function* () {
    const [command, ...args] = process.argv
      .slice(2)
      .filter((arg, index) => !(index === 0 && arg === "--"));
    if (command !== "pulumi") return yield* fail("only_pulumi_allowed");
    const exitCode = yield* runWithState(args);
    process.exitCode = exitCode;
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "state.command_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
