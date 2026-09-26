import { bootstrapDatabase, loadRemoteMigrations } from "@repo/db/migrations";
import { Effect } from "effect";

import { remoteDatabase } from "./remote-http.ts";
import { parseRemoteInput } from "./remote-input.ts";

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
  { operation, target }: Extract<RemoteInput, { readonly execute: false }>,
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
  target,
}: Extract<RemoteInput, { readonly execute: true }>) {
  yield* bootstrapDatabase({ database: remoteDatabase(target), email: target.email });
  return {
    databaseId: target.databaseId,
    event: "database.remote_admin_bootstrapped",
    ok: true,
  } as const;
});

const runRemoteDatabaseCommand = Effect.fn("runRemoteDatabaseCommand")(
  function* runRemoteDatabaseCommand(commandArguments: readonly string[], input: unknown) {
    const remoteInput = yield* parseRemoteInput(commandArguments, input);
    return remoteInput.execute
      ? yield* executeRemote(remoteInput)
      : planReport(remoteInput, yield* loadRemoteMigrations());
  },
);

export { runRemoteDatabaseCommand };
