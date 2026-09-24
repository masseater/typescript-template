import { count, type SQL } from "drizzle-orm";
import { Effect } from "effect";

import { query, type Database, type DrizzleDatabase } from "./database.ts";

import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DatabaseFailure } from "./database-failure.ts";

const countRows = <Table extends SQLiteTable>(
  table: Table,
  where: (database: DrizzleDatabase, counted: Table) => SQL | undefined,
): Effect.Effect<number, DatabaseFailure, Database> =>
  query((database) =>
    database.select({ count: count() }).from(table).where(where(database, table)),
  ).pipe(Effect.map(([counted]) => counted?.count ?? 0));

export { countRows };
