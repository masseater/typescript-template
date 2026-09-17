import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { DatabaseExecutor, RemoteQuery } from "./remote-operations.ts";
import { loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import { Effect } from "effect";
import { RemoteFailure } from "./remote-input.ts";

function prepareBatch(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  database: D1Database,
  queries: readonly RemoteQuery[],
): D1PreparedStatement[] {
  return queries.map((query) => database.prepare(query.sql).bind(...query.params));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function d1Executor(database: D1Database): DatabaseExecutor {
  return {
    batch: (queries) =>
      Effect.tryPromise({
        catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
        try: async () => database.batch(prepareBatch(database, queries)),
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      }).pipe(Effect.map((results) => results.map((item) => item.results))),
  };
}

const migrateD1 = Effect.fn("migrateD1")(function* migrateD1(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  database: D1Database,
) {
  return yield* migrateDatabase(d1Executor(database), yield* loadRemoteMigrations());
});

export { d1Executor, migrateD1, prepareBatch };
