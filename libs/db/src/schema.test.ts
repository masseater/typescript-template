import { describe, expect, it } from "vite-plus/test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/payload/sqlite";
import { schema } from "./schema.ts";

type SqliteSnapshot = Parameters<typeof generateMigration>[0];

const snapshots: Readonly<Record<string, SqliteSnapshot>> = import.meta.glob(
  "../migrations/*/snapshot.json",
  { eager: true, import: "default" },
);

async function pendingStatements(): Promise<readonly string[]> {
  const latest = Object.keys(snapshots)
    .toSorted((left, right) => left.localeCompare(right))
    .at(-1);
  const applied = latest === undefined ? undefined : snapshots[latest];
  return applied === undefined
    ? ["no migration snapshot found"]
    : generateMigration(applied, await generateDrizzleJson(schema));
}

describe("drizzle schema", () => {
  it("drizzle models match the latest generated migration snapshot", async () => {
    expect.hasAssertions();
    await expect(pendingStatements()).resolves.toStrictEqual([]);
  });
});
