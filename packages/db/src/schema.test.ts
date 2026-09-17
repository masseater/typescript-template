import { readFile } from "node:fs/promises";
import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import { expect, test } from "vitest";
import { schema } from "./schema.ts";

test("Drizzle models match the latest generated migration snapshot", async () => {
  const journal: unknown = JSON.parse(
    await readFile(new URL("../migrations/meta/_journal.json", import.meta.url), "utf8"),
  );
  if (
    typeof journal !== "object" ||
    journal === null ||
    !("entries" in journal) ||
    !Array.isArray(journal.entries)
  ) {
    throw new Error("MIGRATION_JOURNAL_INVALID");
  }
  const snapshotNumber = String(journal.entries.length - 1).padStart(4, "0");
  const snapshot: unknown = JSON.parse(
    await readFile(
      new URL(`../migrations/meta/${snapshotNumber}_snapshot.json`, import.meta.url),
      "utf8",
    ),
  );
  if (typeof snapshot !== "object" || snapshot === null || !("tables" in snapshot)) {
    throw new Error("MIGRATION_SNAPSHOT_INVALID");
  }
  const generated: unknown = await generateSQLiteDrizzleJson(schema);
  if (typeof generated !== "object" || generated === null || !("tables" in generated)) {
    throw new Error("GENERATED_SCHEMA_INVALID");
  }
  expect(generated.tables).toEqual(snapshot.tables);
});
