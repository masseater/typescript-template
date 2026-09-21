import {
  bootstrapDatabase,
  fail,
  loadRemoteMigrations,
  migrateDatabase,
  parseRemoteInput,
  remoteDatabase,
} from "@repo/db/migrations";
import { Effect } from "effect";

type Migrations = Effect.Success<ReturnType<typeof loadRemoteMigrations>>;

type RemoteInput = Effect.Success<ReturnType<typeof parseRemoteInput>>;

type PlanReport = {
  readonly databaseId: string;
  readonly event: "database.remote_plan";
  readonly migrations: readonly { readonly hash: string; readonly name: string }[];
  readonly ok: true;
  readonly operation: RemoteInput["operation"];
  readonly remoteStateVerified: false;
};

const planReport = (
  { operation, target }: Readonly<RemoteInput>,
  migrations: Migrations,
): PlanReport => {
  return {
    databaseId: target.databaseId,
    event: "database.remote_plan",
    migrations: migrations.map((migration) => ({ hash: migration.hash, name: migration.name })),
    ok: true,
    operation,
    remoteStateVerified: false,
  };
};

const executeRemote = Effect.fn("executeRemote")(function* executeRemote({
  operation,
  target,
}: Readonly<RemoteInput>) {
  if (target.apiToken === undefined) {
    return yield* fail("REMOTE_INPUT_INVALID");
  }
  const { apply, database } = remoteDatabase({ ...target, apiToken: target.apiToken });
  if (operation === "migrate") {
    const applied = yield* migrateDatabase({ apply, database });
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
  yield* bootstrapDatabase({ database: database, email: target.email });
  return { databaseId: target.databaseId, event: "database.remote_admin_bootstrapped", ok: true };
});

const runRemoteDatabaseCommand = Effect.fn("runRemoteDatabaseCommand")(
  function* runRemoteDatabaseCommand(commandArguments: readonly string[], input: unknown) {
    const remoteInput = yield* parseRemoteInput(commandArguments, input);
    const report: PlanReport | Effect.Success<ReturnType<typeof executeRemote>> =
      remoteInput.execute
        ? yield* executeRemote(remoteInput)
        : planReport(remoteInput, yield* loadRemoteMigrations());
    return report;
  },
);

export { runRemoteDatabaseCommand };
