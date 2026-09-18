import { Effect } from "effect";

import { RemoteFailure } from "./remote-input.ts";
import { loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";

import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { DatabaseExecutor, RemoteQuery } from "./remote-operations.ts";

function prepareBatch(
  database: D1Database,
  queries: readonly RemoteQuery[],
): D1PreparedStatement[] {
  return queries.map((query) => database.prepare(query.sql).bind(...query.params));
}

function d1Executor(database: D1Database): DatabaseExecutor {
  return {
    batch: (queries) =>
      Effect.tryPromise({
        catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
        try: async () => database.batch(prepareBatch(database, queries)),
      }).pipe(Effect.map((results) => results.map((item) => item.results))),
  };
}

const migrateD1 = Effect.fn("migrateD1")(function* migrateD1(database: D1Database) {
  return yield* migrateDatabase(d1Executor(database), yield* loadRemoteMigrations());
});

export { d1Executor, migrateD1, prepareBatch };
