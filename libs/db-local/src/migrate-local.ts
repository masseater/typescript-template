#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/cli";
<<<<<<< HEAD
import { Cause, Console, Effect } from "effect";
=======
import { migrateD1 } from "@repo/db/migrations";
import { Console, Effect } from "effect";
>>>>>>> e11030bf (fix: apply D1 migrations with Drizzle's migrator)

import { localDatabasePlatform } from "./local-platform.ts";

function failed(error: string): Readonly<Record<string, unknown>> {
  return { action: "local_migration", error, success: false };
}

runCli(
  Effect.gen(function* program() {
    const { env } = yield* localDatabasePlatform;
    const applied = yield* migrateD1(env.DB);
    yield* Console.log(JSON.stringify({ action: "local_migration", applied, success: true }));
  }).pipe(
    Effect.scoped,
    Effect.catchTag("RemoteFailure", (failure) => reportFailed(failed(failure.code))),
  ),
  (cause) => ({ ...failed("LOCAL_MIGRATION_FAILED"), cause: Cause.pretty(cause) }),
);
