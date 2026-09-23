import { count, type SQL } from "drizzle-orm";
import { Effect } from "effect";

import { query, type Database, type DrizzleDatabase } from "./database.ts";

import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DatabaseFailure } from "./database-failure.ts";

const countRows = (
  table: SQLiteTable,
  where: (database: DrizzleDatabase) => SQL | undefined,
): Effect.Effect<number, DatabaseFailure, Database> =>
  query((database) => database.select({ count: count() }).from(table).where(where(database))).pipe(
    Effect.map(([row]) => row?.count ?? 0),
  );

export { countRows };
