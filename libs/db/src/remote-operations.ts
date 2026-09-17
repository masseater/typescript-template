import {
  array,
  email,
  integer,
  literal,
  minLength,
  minValue,
  number,
  object,
  parse,
  pipe,
  readonly,
  regex,
  safeParse,
  string,
  trim,
} from "valibot";
import type { InferOutput } from "valibot";
import { compileBootstrapStatement } from "./bootstrap-statement.ts";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";

type RemoteQuery = Readonly<{ params: readonly (string | number | null)[]; sql: string }>;

type DatabaseExecutor = Readonly<{
  batch: (queries: readonly RemoteQuery[]) => Promise<unknown[][]>;
}>;

const statementSchema = pipe(string(), trim(), minLength(1));
const migrationSchema = object({
  folderMillis: pipe(number(), integer(), minValue(1)),
  hash: pipe(string(), regex(/^[a-f0-9]{64}$/u)),
  sql: pipe(array(statementSchema), minLength(1), readonly()),
});
const migrationsSchema = pipe(array(migrationSchema), minLength(1));
const historySchema = array(object({ created_at: number(), hash: string() }));
const bootstrappedAdminSchema = object({
  email: pipe(string(), email()),
  id: string(),
  role: literal("admin"),
});

type Migration = Readonly<InferOutput<typeof migrationSchema>>;

function isChronological(migrations: readonly Migration[]): boolean {
  return migrations.every((item, index) => {
    const previous = migrations[index - 1];
    return previous === undefined || previous.folderMillis < item.folderMillis;
  });
}

function loadRemoteMigrations(): Migration[] {
  try {
    const migrationsFolder = fileURLToPath(new URL("../migrations/", import.meta.url));
    const migrations = parse(migrationsSchema, readMigrationFiles({ migrationsFolder }));
    if (!isChronological(migrations)) {
      throw new Error("invalid");
    }
    return migrations;
  } catch {
    throw new Error("REMOTE_MIGRATIONS_INVALID");
  }
}

async function readHistory(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
): Promise<number> {
  const [rows] = await executor.batch([
    { params: [], sql: "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at" },
  ]);
  const parsed = safeParse(historySchema, rows);
  if (
    !parsed.success ||
    parsed.output.some((item, index) => {
      const expected = migrations[index];
      return (
        expected === undefined ||
        item.hash !== expected.hash ||
        item.created_at !== expected.folderMillis
      );
    })
  ) {
    throw new Error("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return parsed.output.length;
}

function migrationQueries(migration: Migration): RemoteQuery[] {
  return [
    ...migration.sql.map((statement) => ({ params: [], sql: statement })),
    {
      params: [migration.hash, migration.folderMillis],
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    },
  ];
}

async function migrateDatabase(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
): Promise<number> {
  await executor.batch([
    {
      params: [],
      sql: "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, created_at NUMERIC NOT NULL UNIQUE)",
    },
  ]);
  const applied = await readHistory(executor, migrations);
  for (const migration of migrations.slice(applied)) {
    await executor.batch(migrationQueries(migration));
  }
  const recorded = await readHistory(executor, migrations);
  if (recorded !== migrations.length) {
    throw new Error("REMOTE_MIGRATION_HISTORY_MISMATCH");
  }
  return migrations.length - applied;
}

async function bootstrapDatabase(executor: DatabaseExecutor, address: string): Promise<void> {
  const migrations = loadRemoteMigrations();
  const recorded = await readHistory(executor, migrations);
  if (recorded !== migrations.length) {
    throw new Error("REMOTE_MIGRATIONS_REQUIRED");
  }
  const [rows] = await executor.batch([compileBootstrapStatement(address)]);
  if (rows?.length !== 1) {
    throw new Error("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  }
  if (!safeParse(bootstrappedAdminSchema, rows[0]).success) {
    throw new Error("REMOTE_RESPONSE_INVALID");
  }
}

export { bootstrapDatabase, loadRemoteMigrations, migrateDatabase };
export type { DatabaseExecutor, RemoteQuery };
