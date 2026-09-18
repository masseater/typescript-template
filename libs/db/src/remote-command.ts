import { Effect, Schema } from "effect";

import { remoteExecutor } from "./remote-http.ts";
import { RemoteFailure, RemoteTarget, fail, parseRemoteInput } from "./remote-input.ts";
import {
  bootstrapDatabase,
  loadRemoteMigrations,
  migrateDatabase,
  migrationStatus,
} from "./remote-operations.ts";

type RemoteInput = Effect.Success<ReturnType<typeof parseRemoteInput>>;
type Migrations = Effect.Success<ReturnType<typeof loadRemoteMigrations>>;

interface PlanReport {
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

const readRemoteMigrationStatus = Effect.fn("readRemoteMigrationStatus")(
  function* readRemoteMigrationStatus(input: unknown) {
    const target = yield* Schema.decodeUnknownEffect(RemoteTarget)(input, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError(() => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" })));
    if (target.apiToken === undefined || target.email !== undefined) {
      return yield* fail("REMOTE_INPUT_INVALID");
    }
    const executor = remoteExecutor({ ...target, apiToken: target.apiToken });
    const status = yield* migrationStatus(executor, yield* loadRemoteMigrations());
    return { databaseId: target.databaseId, event: "database.remote_migration_status", ...status };
  },
);

export { RemoteFailure } from "./remote-input.ts";
export { readRemoteMigrationStatus, runRemoteDatabaseCommand };
