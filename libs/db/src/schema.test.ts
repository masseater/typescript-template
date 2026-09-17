import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import { schema } from "./schema.ts";

const migrationMeta: Readonly<Record<string, unknown>> = import.meta.glob(
  "../migrations/meta/*.json",
  { eager: true, import: "default" },
);

const SNAPSHOT_NUMBER_WIDTH = 4;
const parseJournal = Schema.decodeUnknownPromise(
  Schema.Struct({ entries: Schema.Array(Schema.Unknown) }),
);
const parseSnapshot = Schema.decodeUnknownPromise(
  Schema.Struct({ tables: Schema.Record(Schema.String, Schema.Unknown) }),
);

async function readLatestSnapshotTables(): Promise<unknown> {
  const journal = await parseJournal(migrationMeta["../migrations/meta/_journal.json"]);
  const snapshotNumber = String(journal.entries.length - 1).padStart(SNAPSHOT_NUMBER_WIDTH, "0");
  const snapshot = await parseSnapshot(
    migrationMeta[`../migrations/meta/${snapshotNumber}_snapshot.json`],
  );
  return snapshot.tables;
}

async function generateSerializedTables(): Promise<unknown> {
  const generated = await parseSnapshot(await generateSQLiteDrizzleJson(schema));
  const serialized = JSON.stringify(generated.tables);
  return JSON.parse(serialized);
}

describe("drizzle schema", () => {
  it("drizzle models match the latest generated migration snapshot", async () => {
    expect.hasAssertions();
    const generated = await generateSerializedTables();
    expect(generated).toStrictEqual(await readLatestSnapshotTables());
  });
});
