import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { getTableColumns } from "drizzle-orm";
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
    const migrations = new URL("../migrations/", import.meta.url);
    const files = (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      const content = await readFile(new URL(file, migrations), "utf8");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      await binding.batch(statements.map((statement) => binding.prepare(statement)));
    }
    return { database: createDb(binding), binding, dispose: () => runtime.dispose() };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
