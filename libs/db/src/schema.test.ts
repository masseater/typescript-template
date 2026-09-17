import { array, object, parse, record, string, unknown } from "valibot";
import { describe, expect, it } from "vite-plus/test";
import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import { schema } from "./schema.ts";

const migrationMeta: Readonly<Record<string, unknown>> = import.meta.glob(
  "../migrations/meta/*.json",
  { eager: true, import: "default" },
);

const SNAPSHOT_NUMBER_WIDTH = 4;
const journalSchema = object({ entries: array(unknown()) });
const snapshotSchema = object({ tables: record(string(), unknown()) });

function readLatestSnapshotTables(): unknown {
  const journal = parse(journalSchema, migrationMeta["../migrations/meta/_journal.json"]);
  const snapshotNumber = String(journal.entries.length - 1).padStart(SNAPSHOT_NUMBER_WIDTH, "0");
  const snapshot = parse(
    snapshotSchema,
    migrationMeta[`../migrations/meta/${snapshotNumber}_snapshot.json`],
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
    const generated = await generateSerializedTables();
    expect(generated).toStrictEqual(readLatestSnapshotTables());
  });
});
