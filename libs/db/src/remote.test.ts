import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import { createD1Executor, createEmptyTestDatabase } from "./testing.ts";
import { describe, expect, it } from "vite-plus/test";
import { session, user } from "./schema.ts";
import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./index.ts";
import type { DatabaseExecutor } from "./remote-operations.ts";
import { bootstrapAdmin } from "./admin.ts";
import { createDb } from "./index.ts";
import { getSessionSecurity } from "./security.ts";
import { parseRemoteInput } from "./remote-input.ts";

const ACCOUNT_ID_LENGTH = 32;
const MIGRATION_HASH_LENGTH = 64;
const SESSION_LIFETIME_MS = 60_000;
const REAL_D1_TIMEOUT_MS = 60_000;

const target = {
  accountId: "a".repeat(ACCOUNT_ID_LENGTH),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};

type RemoteMigration = ReturnType<typeof loadRemoteMigrations>[number];

type RemoteFixture = Readonly<{
  binding: Readonly<D1Database>;
  database: Readonly<Pick<Database, "all" | "insert" | "select">>;
  executor: DatabaseExecutor;
  migrations: readonly RemoteMigration[];
}>;
type Context = Readonly<{ remote: RemoteFixture }>;

const test = it.extend<Context>({
  remote: async ({}: Readonly<object>, provide) => {
    const { binding, dispose } = await createEmptyTestDatabase("remote-lifecycle-test");
    try {
      await provide({
        binding,
        database: createDb(binding),
        executor: createD1Executor(binding),
        migrations: loadRemoteMigrations(),
      });
    } finally {
      await dispose();
    }
  },
});

function bootstrapCandidate(id: string, emailVerified: boolean): typeof user.$inferInsert {
  return {
    createdAt: new Date(),
    email: `${id}@example.test`,
    emailVerified,
    id,
    name: id,
    updatedAt: new Date(),
  };
}

async function prepareBootstrapCandidates(
  executor: DatabaseExecutor,
  database: Readonly<Pick<Database, "insert">>,
): Promise<void> {
  await migrateDatabase(executor, loadRemoteMigrations());
  await database
    .insert(user)
    .values([
      bootstrapCandidate("unverified", false),
      bootstrapCandidate("first", true),
      bootstrapCandidate("second", true),
    ]);
}

function withInterruptedMigration(migrations: readonly RemoteMigration[]): RemoteMigration[] {
  const lastCreatedAt = migrations.at(-1)?.folderMillis ?? 0;
  return [
    ...migrations,
    {
      folderMillis: lastCreatedAt + 1,
      hash: "b".repeat(MIGRATION_HASH_LENGTH),
      sql: [
        "CREATE TABLE interrupted_migration (id TEXT)",
        "INSERT INTO missing_migration_table VALUES (1)",
      ],
    },
  ];
}

function withChangedFirstHash(migrations: readonly RemoteMigration[]): RemoteMigration[] {
  return migrations.map((migration, index) =>
    index === 0 ? { ...migration, hash: "changed" } : migration,
  );
}

describe("remote input", () => {
  it("requires explicit execution, exact target confirmation and a non-placeholder database", () => {
    expect.hasAssertions();
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
      execute: false,
      operation: "migrate",
    });
  });

  it.for([
    { args: ["bootstrap", "--plan"], code: "REMOTE_INPUT_INVALID" },
    { args: ["migrate", "--plan", "extra"], code: "REMOTE_COMMAND_INVALID" },
  ] as const)("rejects $args without printing inputs", ({ args, code }) => {
    expect.hasAssertions();
    expect(() => parseRemoteInput(args, target)).toThrow(code);
  });

  it("rejects an invalid bootstrap identity without printing it", () => {
    expect.hasAssertions();
    expect(() =>
      parseRemoteInput(["bootstrap", "--plan"], { ...target, email: "private-invalid-email" }),
    ).toThrow("REMOTE_INPUT_INVALID");
  });
});

describe("remote migrations on real D1", { timeout: REAL_D1_TIMEOUT_MS }, () => {
  test("applies real D1 migrations once", async ({ remote }: Context) => {
    expect.hasAssertions();
    await expect(migrateDatabase(remote.executor, remote.migrations)).resolves.toBe(
      remote.migrations.length,
    );
    await expect(migrateDatabase(remote.executor, remote.migrations)).resolves.toBe(0);
  });

  test("rolls back an interrupted migration", async ({ remote }: Context) => {
    expect.hasAssertions();
    await migrateDatabase(remote.executor, remote.migrations);
    await expect(
      migrateDatabase(remote.executor, withInterruptedMigration(remote.migrations)),
    ).rejects.toThrow("missing_migration_table");
    await expect(
      remote.binding
        .prepare("SELECT name FROM sqlite_master WHERE name = ?")
        .bind("interrupted_migration")
        .all(),
    ).resolves.toMatchObject({ results: [] });
    await expect(migrateDatabase(remote.executor, remote.migrations)).resolves.toBe(0);
  });

  test("rejects changed migration history", async ({ remote }: Context) => {
    expect.hasAssertions();
    await migrateDatabase(remote.executor, remote.migrations);
    await expect(
      migrateDatabase(remote.executor, withChangedFirstHash(remote.migrations)),
    ).rejects.toThrow("REMOTE_MIGRATION_HISTORY_MISMATCH");
  });
});

describe("remote administrator bootstrap on real D1", { timeout: REAL_D1_TIMEOUT_MS }, () => {
  test("requires a verified existing user", async ({ remote }: Context) => {
    expect.hasAssertions();
    await prepareBootstrapCandidates(remote.executor, remote.database);
    await expect(bootstrapDatabase(remote.executor, "unverified@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await expect(bootstrapDatabase(remote.executor, "missing@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
  });

  test("promotes one administrator and revokes existing sessions", async ({ remote }: Context) => {
    expect.hasAssertions();
    await prepareBootstrapCandidates(remote.executor, remote.database);
    await remote.database.insert(session).values({
      audience: "user",
      authenticationMethod: "password",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      id: "old-session",
      securityVersion: 0,
      token: "old-token",
      updatedAt: new Date(),
      userId: "first",
    });
    await bootstrapDatabase(remote.executor, "FIRST@example.test");
    await expect(
      getSessionSecurity(remote.database, "old-session", "user"),
    ).resolves.toBeUndefined();
    await expect(bootstrapDatabase(remote.executor, "second@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
    await expect(bootstrapAdmin(remote.database, "second@example.test")).rejects.toThrow(
      "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
    );
  });

  test("protects the bootstrapped last administrator", async ({ remote }: Context) => {
    expect.hasAssertions();
    await prepareBootstrapCandidates(remote.executor, remote.database);
    await bootstrapDatabase(remote.executor, "first@example.test");
    await expect(
      remote.binding.prepare("DELETE FROM user WHERE id = ?").bind("first").run(),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
    await expect(
      remote.binding.prepare("UPDATE user SET role = 'user' WHERE id = ?").bind("first").run(),
    ).rejects.toThrow("LAST_ADMIN_REQUIRED");
  });
});
