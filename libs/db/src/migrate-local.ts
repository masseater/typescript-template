import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";

import { localPlatform } from "./local-platform.ts";
import { migrateD1 } from "./migrate-d1.ts";

const report = (failureCode: string): Effect.Effect<void> => {
  return Console.error(
    JSON.stringify({ action: "local_migration", error: failureCode, success: false }),
  ).pipe(
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 1;
      }),
    ),
  );
};

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const { env } = yield* localPlatform;
    const applied = yield* migrateD1(env.DB);
    yield* Console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("RemoteFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("LOCAL_MIGRATION_FAILED")),
  ),
  { disableErrorReporting: true },
);
