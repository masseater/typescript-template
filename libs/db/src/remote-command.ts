import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import type { DatabaseExecutor } from "./remote-operations.ts";
import type { RemoteTarget } from "./remote-input.ts";
import { parseRemoteInput } from "./remote-input.ts";
import { remoteExecutor } from "./remote-http.ts";

type RemoteCommandResult =
  | {
      accountId: string;
      databaseId: string;
      event: "database.remote_plan";
      migrations: { createdAt: number; hash: string }[];
      ok: true;
      operation: "migrate" | "bootstrap";
      remoteStateVerified: false;
    }
  | { applied: number; databaseId: string; event: "database.remote_migrated"; ok: true }
  | { databaseId: string; event: "database.remote_admin_bootstrapped"; ok: true };

function targetExecutor(target: Readonly<RemoteTarget>): DatabaseExecutor {
  if (target.apiToken === undefined) {
    throw new Error("REMOTE_INPUT_INVALID");
  }
  return remoteExecutor({ ...target, apiToken: target.apiToken });
}

async function executeBootstrap(target: Readonly<RemoteTarget>): Promise<RemoteCommandResult> {
  const executor = targetExecutor(target);
  if (target.email === undefined) {
    throw new Error("REMOTE_INPUT_INVALID");
  }
  await bootstrapDatabase(executor, target.email);
  return { databaseId: target.databaseId, event: "database.remote_admin_bootstrapped", ok: true };
}

async function runRemoteDatabaseCommand(
  args: readonly string[],
  input: unknown,
): Promise<RemoteCommandResult> {
  const { operation, execute, target } = parseRemoteInput(args, input);
  const migrations = loadRemoteMigrations();
  if (!execute) {
    return {
      accountId: target.accountId,
      databaseId: target.databaseId,
      event: "database.remote_plan",
      migrations: migrations.map((item) => ({ createdAt: item.folderMillis, hash: item.hash })),
      ok: true,
      operation,
      remoteStateVerified: false,
    };
  }
  if (operation === "bootstrap") {
    return executeBootstrap(target);
  }
  const applied = await migrateDatabase(targetExecutor(target), migrations);
  return { applied, databaseId: target.databaseId, event: "database.remote_migrated", ok: true };
}

export { runRemoteDatabaseCommand };
