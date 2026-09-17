import { Effect } from "effect";
import { remoteExecutor } from "./remote-http.ts";
import { fail, parseRemoteInput } from "./remote-input.ts";
import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";

export { RemoteFailure } from "./remote-input.ts";

export const runRemoteDatabaseCommand = Effect.fn("runRemoteDatabaseCommand")(function* (
  args: readonly string[],
  input: unknown,
) {
  const { operation, execute, target } = yield* parseRemoteInput(args, input);
  const migrations = yield* loadRemoteMigrations();
  if (!execute)
    return {
      ok: true,
      event: "database.remote_plan",
      operation,
      accountId: target.accountId,
      databaseId: target.databaseId,
      migrations: migrations.map((item) => ({ hash: item.hash, createdAt: item.folderMillis })),
      remoteStateVerified: false,
    } as const;
  if (target.apiToken === undefined) return yield* fail("REMOTE_INPUT_INVALID");
  const executor = remoteExecutor({ ...target, apiToken: target.apiToken });
  if (operation === "migrate") {
    const applied = yield* migrateDatabase(executor, migrations);
    return {
      ok: true,
      event: "database.remote_migrated",
      databaseId: target.databaseId,
      applied,
    } as const;
  }
  if (target.email === undefined) return yield* fail("REMOTE_INPUT_INVALID");
  yield* bootstrapDatabase(executor, target.email);
  return {
    ok: true,
    event: "database.remote_admin_bootstrapped",
    databaseId: target.databaseId,
  } as const;
});
