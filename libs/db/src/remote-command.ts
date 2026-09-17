import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import { fail, parseRemoteInput } from "./remote-input.ts";
import { Effect } from "effect";
import { remoteExecutor } from "./remote-http.ts";

type RemoteInput = Effect.Success<ReturnType<typeof parseRemoteInput>>;
type Migrations = Effect.Success<ReturnType<typeof loadRemoteMigrations>>;

interface PlanReport {
  readonly accountId: string;
  readonly databaseId: string;
  readonly event: "database.remote_plan";
  readonly migrations: readonly { readonly hash: string; readonly name: string }[];
  readonly ok: true;
  readonly operation: RemoteInput["operation"];
  readonly remoteStateVerified: false;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function planReport({ operation, target }: RemoteInput, migrations: Migrations): PlanReport {
  return {
    accountId: target.accountId,
    databaseId: target.databaseId,
    event: "database.remote_plan",
    migrations: migrations.map((item) => ({ hash: item.hash, name: item.name })),
    ok: true,
    operation,
    remoteStateVerified: false,
  };
}

const executeRemote = Effect.fn("executeRemote")(function* executeRemote(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { operation, target }: RemoteInput,
  migrations: Migrations,
) {
  if (target.apiToken === undefined) {
    return yield* fail("REMOTE_INPUT_INVALID");
  }
  const executor = remoteExecutor({ ...target, apiToken: target.apiToken });
  if (operation === "migrate") {
    const applied = yield* migrateDatabase(executor, migrations);
    return {
      applied,
      databaseId: target.databaseId,
      event: "database.remote_migrated",
      ok: true,
    } as const;
  }
  if (target.email === undefined) {
    return yield* fail("REMOTE_INPUT_INVALID");
  }
  yield* bootstrapDatabase(executor, target.email);
  return { databaseId: target.databaseId, event: "database.remote_admin_bootstrapped", ok: true };
});

const runRemoteDatabaseCommand = Effect.fn("runRemoteDatabaseCommand")(
  function* runRemoteDatabaseCommand(args: readonly string[], input: unknown) {
    const parsed = yield* parseRemoteInput(args, input);
    const migrations = yield* loadRemoteMigrations();
    const report: PlanReport | Effect.Success<ReturnType<typeof executeRemote>> = parsed.execute
      ? yield* executeRemote(parsed, migrations)
      : planReport(parsed, migrations);
    return report;
  },
);

export { RemoteFailure } from "./remote-input.ts";
export { runRemoteDatabaseCommand };
