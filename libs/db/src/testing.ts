import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import type { DatabaseExecutor, RemoteQuery } from "./remote-operations.ts";
import { array, null_, number, object, parse, string, union } from "valibot";
import type { Database } from "./index.ts";
import { Miniflare } from "miniflare";
import { createDb } from "./index.ts";
import { getTableColumns } from "drizzle-orm";
import { loadRemoteMigrations } from "./remote-operations.ts";
import { schema } from "./schema.ts";

interface D1HttpBatchResponse {
  result: D1Result[];
  success: true;
}

interface EmptyTestDatabase {
  binding: D1Database;
  dispose: () => Promise<void>;
}

interface TestDatabase extends EmptyTestDatabase {
  database: Database;
}

const httpParamSchema = union([string(), number(), null_()]);
const httpQuerySchema = object({ params: array(httpParamSchema), sql: string() });
const httpBatchSchema = object({ batch: array(httpQuerySchema) });

function prepareBatch(
  binding: Readonly<D1Database>,
  queries: readonly RemoteQuery[],
): D1PreparedStatement[] {
  return queries.map((query) => binding.prepare(query.sql).bind(...query.params));
}

function createD1Executor(binding: Readonly<D1Database>): DatabaseExecutor {
  return {
    batch: async (queries) => {
      const results = await binding.batch(prepareBatch(binding, queries));
      return results.map((item: Readonly<{ results: readonly unknown[] }>) => item.results);
    },
  };
}

async function executeD1HttpBatch(
  binding: Readonly<D1Database>,
  body: unknown,
): Promise<D1HttpBatchResponse> {
  const { batch } = parse(httpBatchSchema, body);
  const result = await binding.batch(prepareBatch(binding, batch));
  return { result, success: true };
}

function getSchemaShape(): Record<string, string[]> {
  return Object.fromEntries(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Object.entries(schema).map(([name, table]) => [name, Object.keys(getTableColumns(table))]),
  );
}

async function applyMigrations(binding: Readonly<D1Database>): Promise<void> {
  for (const migration of loadRemoteMigrations()) {
    // oxlint-disable-next-line no-await-in-loop
    await binding.batch(migration.sql.map((statement) => binding.prepare(statement)));
  }
}

async function createEmptyTestDatabase(name: string): Promise<EmptyTestDatabase> {
  const runtime = new Miniflare({
    compatibilityDate: "2026-07-30",
    d1Databases: { DB: name },
    modules: true,
    script: "export default { fetch() { return new Response('test-database'); } };",
  });
  try {
    const binding = await runtime.getD1Database("DB");
    return { binding, dispose: async () => runtime.dispose() };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}

async function createTestDatabase(): Promise<TestDatabase> {
  const { binding, dispose } = await createEmptyTestDatabase("template-test");
  try {
    await applyMigrations(binding);
    return { binding, database: createDb(binding), dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export {
  createD1Executor,
  createEmptyTestDatabase,
  createTestDatabase,
  executeD1HttpBatch,
  getSchemaShape,
};
