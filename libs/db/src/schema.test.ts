import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import { expect, test } from "vite-plus/test";
import { schema } from "./schema.ts";
import journal from "../migrations/meta/_journal.json" with { type: "json" };

const snapshots: Record<string, unknown> = import.meta.glob("../migrations/meta/*_snapshot.json", {
  eager: true,
  import: "default",
});

test("Drizzle models match the latest generated migration snapshot", async () => {
  const snapshotNumber = String(journal.entries.length - 1).padStart(4, "0");
  const snapshot = snapshots[`../migrations/meta/${snapshotNumber}_snapshot.json`];
  if (typeof snapshot !== "object" || snapshot === null || !("tables" in snapshot)) {
    throw new Error("MIGRATION_SNAPSHOT_INVALID");
  }
  const generated: unknown = await generateSQLiteDrizzleJson(schema);
  if (typeof generated !== "object" || generated === null || !("tables" in generated)) {
    throw new Error("GENERATED_SCHEMA_INVALID");
  }
  expect(generated.tables).toEqual(snapshot.tables);
});
