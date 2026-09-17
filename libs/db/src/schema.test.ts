import { array, object, parse, record, string, unknown } from "valibot";
import { describe, expect, it } from "vitest";
import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import { readFile } from "node:fs/promises";
import { schema } from "./schema.ts";

const SNAPSHOT_NUMBER_WIDTH = 4;
const journalSchema = object({ entries: array(unknown()) });
const snapshotSchema = object({ tables: record(string(), unknown()) });

async function readMigrationJson(path: string): Promise<unknown> {
  const content = await readFile(new URL(`../migrations/meta/${path}`, import.meta.url), "utf-8");
  return JSON.parse(content);
}

async function readLatestSnapshotTables(): Promise<unknown> {
  const journal = parse(journalSchema, await readMigrationJson("_journal.json"));
  const snapshotNumber = String(journal.entries.length - 1).padStart(SNAPSHOT_NUMBER_WIDTH, "0");
  const snapshot = parse(
    snapshotSchema,
    await readMigrationJson(`${snapshotNumber}_snapshot.json`),
  );
  return snapshot.tables;
}

async function generateSerializedTables(): Promise<unknown> {
  const generated = parse(snapshotSchema, await generateSQLiteDrizzleJson(schema));
  const serialized = JSON.stringify(generated.tables);
  return JSON.parse(serialized);
}

describe("drizzle schema", () => {
  it("drizzle models match the latest generated migration snapshot", async () => {
    expect.hasAssertions();
    const [generated, snapshot] = await Promise.all([
      generateSerializedTables(),
      readLatestSnapshotTables(),
    ]);
    expect(generated).toStrictEqual(snapshot);
  });
});
