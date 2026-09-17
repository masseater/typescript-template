import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { getTableColumns } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Context, Effect, Layer } from "effect";
import { Miniflare } from "miniflare";
import { Database } from "./index.ts";
import { schema } from "./schema.ts";

export function getSchemaShape() {
  return Object.fromEntries(
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getTableColumns(table))]),
  );
}

export class TestBinding extends Context.Service<TestBinding, D1Database>()(
  "@template/db/TestBinding",
) {}

const migrate = async (binding: D1Database) => {
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)),
  });
  for (const migration of migrations) {
    const statements = migration.sql.map((statement) => statement.trim()).filter(Boolean);
    await binding.batch(statements.map((statement) => binding.prepare(statement)));
  }
};

const binding = (migrated: boolean) =>
  Layer.effect(
    TestBinding,
    Effect.acquireRelease(
      Effect.promise(async () => {
        const runtime = new Miniflare({
          modules: true,
          script: "export default { fetch() { return new Response('test-database'); } };",
          compatibilityDate: "2026-07-30",
          d1Databases: { DB: "template-test" },
        });
        const d1 = await runtime.getD1Database("DB");
        if (migrated) await migrate(d1);
        return { runtime, d1 };
      }),
      ({ runtime }) => Effect.promise(() => runtime.dispose()),
    ).pipe(Effect.map(({ d1 }) => d1)),
  );

const database = Layer.unwrap(
  Effect.gen(function* () {
    return Database.layer(yield* TestBinding);
  }),
);

export const TestDatabase = database.pipe(Layer.provideMerge(binding(true)));

export const EmptyTestDatabase = database.pipe(Layer.provideMerge(binding(false)));
export { bootstrapAdmin } from "./bootstrap-statement.ts";
