import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { getTableColumns } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createDb } from "./index.ts";
import { schema } from "./schema.ts";

export function getSchemaShape() {
  return Object.fromEntries(
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getTableColumns(table))]),
  );
}

export async function createTestDatabase() {
  const runtime = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test-database'); } };",
    compatibilityDate: "2026-07-30",
    d1Databases: { DB: "template-test" },
  });
  try {
    const binding = await runtime.getD1Database("DB");
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)),
    });
    for (const migration of migrations) {
      const statements = migration.sql.map((statement) => statement.trim()).filter(Boolean);
      await binding.batch(statements.map((statement) => binding.prepare(statement)));
    }
    return { database: createDb(binding), binding, dispose: () => runtime.dispose() };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
