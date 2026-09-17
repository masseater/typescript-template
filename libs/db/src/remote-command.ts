import { parseRemoteInput } from "./remote-input.ts";
import { remoteExecutor } from "./remote-http.ts";
import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";

export async function runRemoteDatabaseCommand(args: readonly string[], input: unknown) {
  const { operation, execute, target } = parseRemoteInput(args, input);
  const migrations = loadRemoteMigrations();
  if (!execute)
    return {
      ok: true,
      event: "database.remote_plan",
      operation,
      accountId: target.accountId,
      databaseId: target.databaseId,
      migrations: migrations.map((item) => ({ hash: item.hash, createdAt: item.folderMillis })),
      remoteStateVerified: false,
    };
  if (!target.apiToken) throw new Error("REMOTE_INPUT_INVALID");
  const executor = remoteExecutor({ ...target, apiToken: target.apiToken });
  if (operation === "migrate") {
    const applied = await migrateDatabase(executor, migrations);
    return { ok: true, event: "database.remote_migrated", databaseId: target.databaseId, applied };
  }
  if (!target.email) throw new Error("REMOTE_INPUT_INVALID");
  await bootstrapDatabase(executor, target.email);
  return { ok: true, event: "database.remote_admin_bootstrapped", databaseId: target.databaseId };
}
