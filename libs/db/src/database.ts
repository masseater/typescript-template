import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";

import { DatabaseFailure } from "./database-failure.ts";

function connect(binding: D1Database): ReturnType<typeof drizzle> {
  return drizzle(binding);
}

type DrizzleDatabase = ReturnType<typeof connect>;

class Database extends Context.Service<Database, DrizzleDatabase>()("@template/db/Database") {
  public static layer(binding: D1Database): Layer.Layer<Database> {
    return Layer.sync(Database, () => connect(binding));
  }
}

function query<Value>(
  run: (database: DrizzleDatabase) => PromiseLike<Value>,
): Effect.Effect<Value, DatabaseFailure, Database> {
  return Effect.gen(function* runQuery() {
    const database = yield* Database;
    return yield* Effect.tryPromise({
      catch: (cause) => new DatabaseFailure({ cause }),
      try: async () => run(database),
    });
  });
}

export { Database, query };
export type { DrizzleDatabase };
