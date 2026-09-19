import { reportFailed, runCli } from "@repo/config/cli";
import { Console, Effect } from "effect";

import { localPlatform } from "./local-platform.ts";
import { migrateD1 } from "./migrate-d1.ts";

const failed = (failureCode: string): Readonly<Record<string, unknown>> => ({
  action: "local_migration",
  error: failureCode,
  success: false,
});

runCli(
  Effect.gen(function* program() {
    const { env } = yield* localPlatform;
    const applied = yield* migrateD1(env.DB);
    yield* Console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("RemoteFailure", (failure) => reportFailed(failed(failure.code))),
  ),
  failed("LOCAL_MIGRATION_FAILED"),
);
