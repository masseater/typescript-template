import { expect, test as baseTest } from "vitest";
import { createDb, getProfile, updateProfile } from "./index.ts";
import { instrumentD1 } from "./instrumentation.ts";
import type { DatabaseOperation, DatabaseTrace } from "./instrumentation.ts";
import { user } from "./schema.ts";
import { createTestDatabase } from "./testing.ts";

async function createFixture() {
  const resource = await createTestDatabase();
  const events: { operation: DatabaseOperation; duration: number; failed: boolean }[] = [];
  const errors: unknown[] = [];
  const trace: DatabaseTrace = async (operation, execute) => {
    const started = performance.now();
    let failed = false;
    try {
      return await execute();
    } catch (error) {
      failed = true;
      errors.push(error);
      throw error;
    } finally {
      events.push({ operation, duration: performance.now() - started, failed });
    }
  };
  return {
    ...resource,
    database: createDb(resource.binding, trace),
    observed: instrumentD1(resource.binding, trace),
    events,
    errors,
  };
}

const test = baseTest.extend<{ db: Awaited<ReturnType<typeof createFixture>> }>({
  db: async ({}, provide) => {
    const db = await createFixture();
    try {
      await provide(db);
    } finally {
      await db.dispose();
    }
  },
});

test("measures actual Drizzle queries without exposing SQL or bound personal data", async ({
  db,
}) => {
  await db.database.insert(user).values({
    id: "observed",
    name: "private-name",
    email: "private-email@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(await getProfile(db.database, "observed")).toMatchObject({ name: "private-name" });
  await updateProfile(db.database, "observed", { name: "updated", profile: "private-profile" });
  await db.database.delete(user);
  expect(await getProfile(db.database, "observed")).toBeNull();
  expect(db.events.map((event) => event.operation)).toEqual([
    "INSERT",
    "SELECT",
    "UPDATE",
    "DELETE",
    "SELECT",
  ]);
  for (const event of db.events) {
    expect(event.failed).toBe(false);
    expect(event.duration).toBeGreaterThanOrEqual(0);
    expect(Object.keys(event).sort()).toEqual(["duration", "failed", "operation"]);
  }
  expect(JSON.stringify(db.events)).not.toContain("private");
});

test("delegates bound first, all, run and raw overloads to real prepared statements", async ({
  db,
}) => {
  const statement = db.observed.prepare("SELECT ? AS value").bind("private-value");
  expect(db.events).toHaveLength(0);
  expect(await statement.first()).toEqual({ value: "private-value" });
  expect(await statement.first<string>("value")).toBe("private-value");
  expect((await statement.all()).results).toEqual([{ value: "private-value" }]);
  expect((await statement.run()).success).toBe(true);
  expect(await statement.raw()).toEqual([["private-value"]]);
  expect(await statement.raw({ columnNames: false })).toEqual([["private-value"]]);
  expect(await statement.raw({ columnNames: true })).toEqual([["value"], ["private-value"]]);
  expect(db.events.map((event) => event.operation)).toEqual(Array<string>(7).fill("SELECT"));
  expect(await db.observed.prepare("SELECT 1 WHERE 0").first()).toBeNull();
});

test("keeps native batch atomicity and original errors without duplicating query spans", async ({
  db,
}) => {
  await db.observed.prepare("CREATE TABLE measurement (id TEXT PRIMARY KEY)").run();
  const batch = await db.observed.batch([
    db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("existing"),
    db.binding.prepare("SELECT id FROM measurement"),
  ]);
  expect(batch[1]?.results).toEqual([{ id: "existing" }]);
  expect(db.events.map((event) => event.operation)).toEqual(["MIGRATE", "TRANSACTION"]);
  const outcome = await Promise.allSettled([
    db.observed.batch([
      db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("rolled-back"),
      db.observed.prepare("INSERT INTO measurement VALUES (?)").bind("existing"),
    ]),
  ]);
  const result = outcome[0];
  expect(result?.status).toBe("rejected");
  if (result?.status !== "rejected") throw new Error("EXPECTED_D1_CONSTRAINT_ERROR");
  expect(result.reason).toBe(db.errors[0]);
  expect(db.events.at(-1)).toMatchObject({ operation: "TRANSACTION", failed: true });
  expect(await db.binding.prepare("SELECT id FROM measurement ORDER BY id").raw()).toEqual([
    ["existing"],
  ]);
});

test("records native statement failures and conservatively classifies nontrivial SQL", async ({
  db,
}) => {
  await expect(db.observed.prepare("SELECT * FROM missing_table").all()).rejects.toThrow(
    "no such table",
  );
  expect(db.events[0]).toMatchObject({ operation: "SELECT", failed: true });
  expect(
    await db.observed.prepare("/* private-comment */ SELECT ? AS value").bind("private").first(),
  ).toEqual({ value: "private" });
  expect(
    await db.observed.prepare("WITH value AS (SELECT 1 AS id) SELECT id FROM value").first(),
  ).toEqual({ id: 1 });
  await db.observed.exec("CREATE TABLE execution_test (id INTEGER)");
  expect(db.events.map((event) => event.operation)).toEqual(["SELECT", "OTHER", "OTHER", "OTHER"]);
  expect(JSON.stringify(db.events)).not.toContain("private");
});

test("preserves real D1 session prepare, batch and bookmark behavior", async ({ db }) => {
  const session = db.observed.withSession("first-primary");
  expect(await session.prepare("SELECT ? AS value").bind(3).first<number>("value")).toBe(3);
  expect((await session.batch([session.prepare("SELECT 4 AS value")]))[0]?.results).toEqual([
    { value: 4 },
  ]);
  const bookmark = session.getBookmark();
  expect(bookmark === null || typeof bookmark === "string").toBe(true);
  const next = db.observed.withSession(bookmark ?? "first-unconstrained");
  expect(await next.prepare("SELECT 5 AS value").first<number>("value")).toBe(5);
  expect(db.events.map((event) => event.operation)).toEqual(["SELECT", "TRANSACTION", "SELECT"]);
});
