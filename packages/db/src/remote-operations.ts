import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as v from "valibot";
import { compileBootstrapStatement } from "./bootstrap-statement.ts";

export interface DatabaseExecutor {
  batch(
    queries: readonly { sql: string; params: (string | number | null)[] }[],
  ): Promise<unknown[][]>;
}

const migrationSchema = v.object({
  sql: v.pipe(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), v.minLength(1)),
  folderMillis: v.pipe(v.number(), v.integer(), v.minValue(1)),
  hash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
type Migration = v.InferOutput<typeof migrationSchema>;

export function loadRemoteMigrations(): Migration[] {
  try {
    const migrations = v.parse(
      v.pipe(v.array(migrationSchema), v.minLength(1)),
      readMigrationFiles({
        migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)),
      }),
    );
    if (
      migrations.some(
        (item, index) => index > 0 && item.folderMillis <= migrations[index - 1]!.folderMillis,
      )
    )
      throw new Error("invalid");
    return migrations;
  } catch {
    throw new Error("REMOTE_MIGRATIONS_INVALID");
  }
}

async function readHistory(executor: DatabaseExecutor, migrations: readonly Migration[]) {
  const [rows] = await executor.batch([
    { sql: "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at", params: [] },
  ]);
  const parsed = v.safeParse(v.array(v.object({ hash: v.string(), created_at: v.number() })), rows);
  if (
    !parsed.success ||
    parsed.output.some(
      (item, index) =>
        item.hash !== migrations[index]?.hash ||
        item.created_at !== migrations[index]?.folderMillis,
    )
  )
    throw new Error("REMOTE_MIGRATION_HISTORY_MISMATCH");
  return parsed.output.length;
}

export async function migrateDatabase(
  executor: DatabaseExecutor,
  migrations: readonly Migration[],
) {
  await executor.batch([
    {
      sql: "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, created_at NUMERIC NOT NULL UNIQUE)",
      params: [],
    },
  ]);
  const applied = await readHistory(executor, migrations);
  for (const migration of migrations.slice(applied)) {
    await executor.batch([
      ...migration.sql.map((sql) => ({ sql, params: [] })),
      {
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        params: [migration.hash, migration.folderMillis],
      },
    ]);
  }
  if ((await readHistory(executor, migrations)) !== migrations.length)
    throw new Error("REMOTE_MIGRATION_HISTORY_MISMATCH");
  return migrations.length - applied;
}

export async function bootstrapDatabase(executor: DatabaseExecutor, email: string) {
  const migrations = loadRemoteMigrations();
  if ((await readHistory(executor, migrations)) !== migrations.length)
    throw new Error("REMOTE_MIGRATIONS_REQUIRED");
  const [rows] = await executor.batch([compileBootstrapStatement(email)]);
  if (rows?.length !== 1) throw new Error("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  const result = v.safeParse(
    v.object({ id: v.string(), email: v.pipe(v.string(), v.email()), role: v.literal("admin") }),
    rows[0],
  );
  if (!result.success) throw new Error("REMOTE_RESPONSE_INVALID");
}
