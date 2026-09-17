import type { DatabaseOperation, DatabaseTrace } from "./database-trace.ts";
import { test as baseTest, expect } from "vite-plus/test";
import { createDb, getProfile, updateProfile } from "./index.ts";
import { parse, string } from "valibot";
import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./index.ts";
import { createTestDatabase } from "./testing.ts";
import { instrumentD1 } from "./instrumentation.ts";
import { user } from "./schema.ts";

interface TraceEvent {
  duration: number;
  failed: boolean;
  operation: DatabaseOperation;
}

type Fixture = Awaited<ReturnType<typeof createTestDatabase>> & {
  errors: unknown[];
  events: TraceEvent[];
  observed: D1Database;
};

async function createFixture(): Promise<Fixture> {
  const resource = await createTestDatabase();
  const events: TraceEvent[] = [];
  const errors: unknown[] = [];
  async function trace<Result>(
    operation: DatabaseOperation,
    execute: () => Promise<Result>,
  ): Promise<Result> {
    const started = performance.now();
    let failed = false;
    try {
      return await execute();
    } catch (error) {
      failed = true;
      errors.push(error);
      throw error;
    } finally {
      events.push({ duration: performance.now() - started, failed, operation });
    }
  }
  const observedTrace: DatabaseTrace = trace;
  return {
    ...resource,
    database: createDb(resource.binding, observedTrace),
    errors,
    events,
    observed: instrumentD1(resource.binding, observedTrace),
  };
}

function operations(events: readonly Readonly<TraceEvent>[]): DatabaseOperation[] {
  return events.map((event) => event.operation);
}

function outcomes(
  events: readonly Readonly<TraceEvent>[],
): Pick<TraceEvent, "failed" | "operation">[] {
  return events.map((event) => ({ failed: event.failed, operation: event.operation }));
}

async function runProfileLifecycle(database: Database): Promise<void> {
  await database.insert(user).values({
    createdAt: new Date(),
    email: "private-email@example.com",
    id: "observed",
    name: "private-name",
    updatedAt: new Date(),
  });
  await getProfile(database, "observed");
  await updateProfile(database, "observed", { name: "updated", profile: "private-profile" });
  await database.delete(user);
  await getProfile(database, "observed");
}

const test = baseTest.extend<{ db: Fixture }>({
  db: async ({}, provide) => {
    const db = await createFixture();
    try {
      await provide(db);
    } finally {
      await db.dispose();
    }
  },
});

test("measures actual Drizzle queries with their operation and outcome", async ({ db }) => {
  await db.database.insert(user).values({
    createdAt: new Date(),
    email: "measured@example.com",
    id: "measured",
    name: "measured-name",
    updatedAt: new Date(),
  });
  await expect(getProfile(db.database, "measured")).resolves.toMatchObject({
    name: "measured-name",
  });
  await db.database.delete(user);
  await expect(getProfile(db.database, "measured")).resolves.toBeNull();
  expect(outcomes(db.events)).toStrictEqual([
    { failed: false, operation: "INSERT" },
    { failed: false, operation: "SELECT" },
    { failed: false, operation: "DELETE" },
    { failed: false, operation: "SELECT" },
  ]);
  expect(Math.min(...db.events.map((event) => event.duration))).toBeGreaterThanOrEqual(0);
});

test("records only operation, outcome and duration without SQL or bound personal data", async ({
  db,
}) => {
  await runProfileLifecycle(db.database);
  expect(operations(db.events)).toStrictEqual(["INSERT", "SELECT", "UPDATE", "DELETE", "SELECT"]);
  expect(db.events.map((event) => Object.keys(event).toSorted())).toStrictEqual(
    db.events.map(() => ["duration", "failed", "operation"]),
  );
  expect(JSON.stringify(db.events)).not.toContain("private");
});

test("delegates bound first and all overloads to real prepared statements", async ({ db }) => {
  const statement = db.observed.prepare("SELECT ? AS value").bind("private-value");
  expect(db.events).toHaveLength(0);
  await expect(statement.first()).resolves.toStrictEqual({ value: "private-value" });
  await expect(statement.first<string>("value")).resolves.toBe("private-value");
  await expect(statement.all()).resolves.toMatchObject({ results: [{ value: "private-value" }] });
  expect(operations(db.events)).toStrictEqual(["SELECT", "SELECT", "SELECT"]);
});

test("delegates bound run and raw overloads to real prepared statements", async ({ db }) => {
  const statement = db.observed.prepare("SELECT ? AS value").bind("private-value");
  await expect(statement.run()).resolves.toMatchObject({ success: true });
  await expect(
    Promise.all([
      statement.raw(),
      statement.raw({ columnNames: false }),
      statement.raw({ columnNames: true }),
    ]),
  ).resolves.toStrictEqual([
    [["private-value"]],
    [["private-value"]],
    [["value"], ["private-value"]],
  ]);
  await expect(db.observed.prepare("SELECT 1 WHERE 0").first()).resolves.toBeNull();
  expect(operations(db.events)).toStrictEqual(["SELECT", "SELECT", "SELECT", "SELECT", "SELECT"]);
});

test("keeps native batch results without duplicating query spans", async ({ db }) => {
  await db.observed.prepare("CREATE TABLE measurement (id TEXT PRIMARY KEY)").run();
  const batch = await db.observed.batch([
    db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("existing"),
    db.binding.prepare("SELECT id FROM measurement"),
  ]);
  expect(batch[1]?.results).toStrictEqual([{ id: "existing" }]);
  expect(operations(db.events)).toStrictEqual(["MIGRATE", "TRANSACTION"]);
});

test("keeps native batch atomicity and original errors", async ({ db }) => {
  await db.binding.prepare("CREATE TABLE measurement (id TEXT PRIMARY KEY)").run();
  await db.binding.prepare("INSERT INTO measurement VALUES (?)").bind("existing").run();
  const failing = db.observed.batch([
    db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("rolled-back"),
    db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("existing"),
  ]);
  await expect(failing).rejects.toThrow("UNIQUE constraint failed");
  await expect(failing).rejects.toBe(db.errors[0]);
  expect(outcomes(db.events)).toStrictEqual([{ failed: true, operation: "TRANSACTION" }]);
  await expect(
    db.binding.prepare("SELECT id FROM measurement ORDER BY id").raw(),
  ).resolves.toStrictEqual([["existing"]]);
});

test("records native statement failures", async ({ db }) => {
  await expect(db.observed.prepare("SELECT * FROM missing_table").all()).rejects.toThrow(
    "no such table",
  );
  expect(outcomes(db.events)).toStrictEqual([{ failed: true, operation: "SELECT" }]);
});

test("conservatively classifies nontrivial SQL without exposing it", async ({ db }) => {
  await expect(
    db.observed.prepare("/* private-comment */ SELECT ? AS value").bind("private").first(),
  ).resolves.toStrictEqual({ value: "private" });
  await expect(
    db.observed.prepare("WITH value AS (SELECT 1 AS id) SELECT id FROM value").first(),
  ).resolves.toStrictEqual({ id: 1 });
  await db.observed.exec("CREATE TABLE execution_test (id INTEGER)");
  expect(operations(db.events)).toStrictEqual(["OTHER", "OTHER", "OTHER"]);
  expect(JSON.stringify(db.events)).not.toContain("private");
});

test("preserves real D1 session prepare, batch and bookmark behavior", async ({ db }) => {
  const session = db.observed.withSession("first-primary");
  await expect(
    session.prepare("SELECT ? AS value").bind("session").first<string>("value"),
  ).resolves.toBe("session");
  const [batched] = await session.batch([session.prepare("SELECT 'batched' AS value")]);
  expect(batched?.results).toStrictEqual([{ value: "batched" }]);
  const bookmark = parse(string(), session.getBookmark());
  const next = db.observed.withSession(bookmark);
  await expect(next.prepare("SELECT 'bookmarked' AS value").first<string>("value")).resolves.toBe(
    "bookmarked",
  );
  expect(operations(db.events)).toStrictEqual(["SELECT", "TRANSACTION", "SELECT"]);
});
