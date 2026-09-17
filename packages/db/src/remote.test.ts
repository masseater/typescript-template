import { Miniflare } from "miniflare";
import { expect, test } from "vitest";
import { createDb } from "./index.ts";
import { bootstrapAdmin } from "./admin.ts";
import { user, session } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { loadRemoteMigrations, migrateDatabase, bootstrapDatabase } from "./remote-operations.ts";
import { parseRemoteInput } from "./remote-input.ts";
import type { DatabaseExecutor } from "./remote-operations.ts";

const target = {
  accountId: "a".repeat(32),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};

test("requires explicit execution, exact target confirmation and a non-placeholder database", () => {
  expect(() => parseRemoteInput(["migrate"], target)).toThrow("REMOTE_COMMAND_INVALID");
  expect(() =>
    parseRemoteInput(["migrate", "--execute", "--confirm-database", target.databaseId], target),
  ).toThrow("REMOTE_INPUT_INVALID");
  expect(() =>
    parseRemoteInput(["migrate", "--execute", "--confirm-database", "wrong"], {
      ...target,
      apiToken: "test-token-at-least-20-characters",
    }),
  ).toThrow("REMOTE_TARGET_MISMATCH");
  expect(() =>
    parseRemoteInput(["migrate", "--plan"], {
      ...target,
      databaseId: "00000000-0000-0000-0000-000000000001",
    }),
  ).toThrow("REMOTE_INPUT_INVALID");
  expect(parseRemoteInput(["migrate", "--plan"], target)).toMatchObject({
    operation: "migrate",
    execute: false,
  });
});

test("rejects missing bootstrap identity and surplus commands without printing inputs", () => {
  for (const args of [
    ["bootstrap", "--plan"],
    ["migrate", "--plan", "extra"],
  ]) {
    expect(() => parseRemoteInput(args, target)).toThrow(/^REMOTE_(INPUT|COMMAND)_INVALID$/);
  }
  expect(() =>
    parseRemoteInput(["bootstrap", "--plan"], { ...target, email: "private-invalid-email" }),
  ).toThrow("REMOTE_INPUT_INVALID");
});

test("applies real D1 migrations once, rejects changed history and preserves bootstrap protections", async () => {
  const runtime = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test-database'); } };",
    compatibilityDate: "2026-07-30",
    d1Databases: { DB: "remote-lifecycle-test" },
  });
  try {
    const binding = await runtime.getD1Database("DB");
    const executor: DatabaseExecutor = {
      batch: async (queries) => {
        const result = await binding.batch(
          queries.map((query) => binding.prepare(query.sql).bind(...query.params)),
        );
        return result.map((item) => item.results);
      },
    };
    const migrations = loadRemoteMigrations();
    expect(await migrateDatabase(executor, migrations)).toBe(migrations.length);
    expect(await migrateDatabase(executor, migrations)).toBe(0);
    const last = migrations.at(-1);
    if (!last) throw new Error("MIGRATIONS_REQUIRED");
    await expect(
      migrateDatabase(executor, [
        ...migrations,
        {
          hash: "b".repeat(64),
          folderMillis: last.folderMillis + 1,
          sql: [
            "CREATE TABLE interrupted_migration (id TEXT)",
            "INSERT INTO missing_migration_table VALUES (1)",
          ],
        },
      ]),
    ).rejects.toThrow("missing_migration_table");
    expect(
      (
        await binding
          .prepare("SELECT name FROM sqlite_master WHERE name = ?")
          .bind("interrupted_migration")
          .all()
      ).results,
    ).toEqual([]);
    expect(await migrateDatabase(executor, migrations)).toBe(0);
    const first = migrations[0];
    if (!first) throw new Error("MIGRATIONS_REQUIRED");
    await expect(
      migrateDatabase(executor, [{ ...first, hash: "changed" }, ...migrations.slice(1)]),
    ).rejects.toThrow("REMOTE_MIGRATION_HISTORY_MISMATCH");
    const db = createDb(binding);
    for (const [id, verified] of [
      ["unverified", false],
      ["first", true],
      ["second", true],
    ] as const) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@example.test`,
        emailVerified: verified,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await expect(bootstrapDatabase(executor, "unverified@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await expect(bootstrapDatabase(executor, "missing@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await db.insert(session).values({
      id: "old-session",
      token: "old-token",
      userId: "first",
      audience: "user",
      securityVersion: 0,
      authenticationMethod: "password",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await bootstrapDatabase(executor, "FIRST@example.test");
    expect(await getSessionSecurity(db, "old-session", "user")).toBeNull();
    await expect(bootstrapDatabase(executor, "second@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await expect(bootstrapAdmin(db, "second@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await expect(
      binding.prepare("DELETE FROM user WHERE id = ?").bind("first").run(),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
    await expect(
      binding.prepare("UPDATE user SET role = 'user' WHERE id = ?").bind("first").run(),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
  } finally {
    await runtime.dispose();
  }
});
