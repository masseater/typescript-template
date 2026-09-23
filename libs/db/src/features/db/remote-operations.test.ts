import { appendFile, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { APPLICATION, AUTHENTICATION_METHOD } from "@repo/config";
import { EmptyTestDatabase, TestBinding, runStatement } from "@repo/db-local";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { bootstrapAdmin, BootstrapUnavailable } from "./bootstrap-statement.ts";
import { query } from "./database.ts";
import { RemoteFailure } from "./remote-input.ts";
import {
  APPLICATION_TABLES,
  bootstrapDatabase,
  loadRemoteMigrations,
  migrateD1,
  migrationsFolder,
} from "./remote-operations.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

describe("migrateD1", () => {
  describe("a first migration of an empty database", () => {
    const it = test
      .extend("migrationCount", async () =>
        Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)))
      .extend("appliedCount", async () =>
        Effect.runPromise(
          Effect.gen(function* migrateOnce() {
            return yield* migrateD1(yield* TestBinding);
          }).pipe(Effect.provide(EmptyTestDatabase)),
        ),
      );

    it("applies every migration", { timeout: 60_000 }, ({ appliedCount, migrationCount }) => {
      expect(appliedCount).toBe(migrationCount);
    });
  });

  describe("a second migration of an up to date database", () => {
    const it = test.extend("appliedCount", async () =>
      Effect.runPromise(
        Effect.gen(function* migrateTwice() {
          const binding = yield* TestBinding;
          yield* migrateD1(binding);
          return yield* migrateD1(binding);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("applies nothing", { timeout: 60_000 }, ({ appliedCount }) => {
      expect(appliedCount).toBe(0);
    });
  });

  describe("a migration whose second statement fails", () => {
    const it = test.extend("migrationFailure", async ({}, { onCleanup }) => {
      const folder = await mkdtemp(path.join(tmpdir(), "template-migrations-"));
      onCleanup(async () => {
        await rm(folder, { force: true, recursive: true });
      });
      await cp(migrationsFolder, folder, { recursive: true });
      const interrupted = path.join(folder, "99999999999999_interrupted");
      await mkdir(interrupted);
      await writeFile(
        path.join(interrupted, "migration.sql"),
        "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
      );
      return Effect.runPromise(
        Effect.gen(function* interrupt() {
          const binding = yield* TestBinding;
          yield* migrateD1(binding);
          return yield* Effect.flip(migrateD1(binding, folder));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      );
    });

    it("fails as a query failure", { timeout: 60_000 }, ({ migrationFailure }) => {
      expect(migrationFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });

  describe("the database after a migration whose second statement failed", () => {
    const it = test.extend("interruptedTables", async ({}, { onCleanup }) => {
      const folder = await mkdtemp(path.join(tmpdir(), "template-migrations-"));
      onCleanup(async () => {
        await rm(folder, { force: true, recursive: true });
      });
      await cp(migrationsFolder, folder, { recursive: true });
      const interrupted = path.join(folder, "99999999999999_interrupted");
      await mkdir(interrupted);
      await writeFile(
        path.join(interrupted, "migration.sql"),
        "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
      );
      return Effect.runPromise(
        Effect.gen(function* interrupt() {
          const binding = yield* TestBinding;
          yield* migrateD1(binding);
          yield* Effect.exit(migrateD1(binding, folder));
          const listing = yield* runStatement(
            "SELECT name FROM sqlite_master WHERE name = ?",
            "interrupted_migration",
          );
          return listing.results;
        }).pipe(Effect.provide(EmptyTestDatabase)),
      );
    });

    it("keeps nothing of the failed migration", { timeout: 60_000 }, ({ interruptedTables }) => {
      expect(interruptedTables).toStrictEqual([]);
    });
  });

  describe("migrations whose already applied history changed", () => {
    const it = test.extend("migrationFailure", async ({}, { onCleanup }) => {
      const folder = await mkdtemp(path.join(tmpdir(), "template-migrations-"));
      onCleanup(async () => {
        await rm(folder, { force: true, recursive: true });
      });
      await cp(migrationsFolder, folder, { recursive: true });
      return Effect.runPromise(
        Effect.gen(function* rewriteHistory() {
          const binding = yield* TestBinding;
          const [first] = yield* loadRemoteMigrations();
          yield* migrateD1(binding);
          if (first === undefined) {
            return new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" });
          }
          yield* Effect.promise(async () =>
            appendFile(path.join(folder, first.name, "migration.sql"), "\n"),
          );
          return yield* Effect.flip(migrateD1(binding, folder));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      );
    });

    it("are refused", { timeout: 60_000 }, ({ migrationFailure }) => {
      expect(migrationFailure).toStrictEqual(
        new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" }),
      );
    });
  });

  describe("a database carrying application tables without a recorded history", () => {
    const it = test.extend("migrationFailure", async () =>
      Effect.runPromise(
        Effect.gen(function* migrateUnrecorded() {
          yield* runStatement("CREATE TABLE user (id TEXT PRIMARY KEY)");
          return yield* Effect.flip(migrateD1(yield* TestBinding));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is refused", { timeout: 60_000 }, ({ migrationFailure }) => {
      expect(migrationFailure).toStrictEqual(
        new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISSING" }),
      );
    });
  });
});

describe("the application tables of a database holding Cloudflare and migration tables", () => {
  const it = test.extend("applicationTables", () => {
    const storage = new DatabaseSync(":memory:");
    for (const tableName of [
      "__drizzle_migrations",
      "_cf_KV",
      "_cf_METADATA",
      "acfxtable",
      "cf_users",
      "d1_migrations",
      "sqlitex_thing",
      "user",
    ]) {
      storage.exec(`CREATE TABLE "${tableName}" (id TEXT)`);
    }
    const listed = storage.prepare(APPLICATION_TABLES).all();
    storage.close();
    return listed.map((listedTable) => String(Object.values(listedTable)[0]));
  });

  it("leave out the Cloudflare and migration tables", ({ applicationTables }) => {
    expect(applicationTables).toStrictEqual(["acfxtable", "cf_users", "sqlitex_thing", "user"]);
  });
});

describe("bootstrapDatabase", () => {
  describe.for([
    ["an unverified user", "unverified@example.test"],
    ["a user who does not exist", "missing@example.test"],
    ["a second verified user after the first was promoted", "second@example.test"],
  ] as const)("%s", ([, email]) => {
    const it = test.extend("bootstrapFailure", async () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapOther() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              [
                { id: "unverified", verified: false },
                { id: "first", verified: true },
                { id: "second", verified: true },
              ].map((seeded) => ({
                createdAt: new Date(),
                email: `${seeded.id}@example.test`,
                emailVerified: seeded.verified,
                id: seeded.id,
                name: seeded.id,
                updatedAt: new Date(),
              })),
            );
          });
          yield* bootstrapDatabase({ database: database, email: "FIRST@example.test" });
          return yield* Effect.flip(bootstrapDatabase({ database: database, email: email }));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is refused", { timeout: 60_000 }, ({ bootstrapFailure }) => {
      expect(bootstrapFailure).toStrictEqual(
        new RemoteFailure({ code: "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN" }),
      );
    });
  });

  describe("the session a user opened before being promoted", () => {
    const it = test.extend("earlierSession", async () =>
      Effect.runPromise(
        Effect.gen(function* promoteFirst() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: new Date(),
              email: "first@example.test",
              emailVerified: true,
              id: "first",
              name: "first",
              updatedAt: new Date(),
            });
            await database.insert(session).values({
              audience: APPLICATION.user,
              authenticationMethod: AUTHENTICATION_METHOD.password,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 60_000),
              id: "old-session",
              securityVersion: 0,
              token: "old-session-token",
              updatedAt: new Date(),
              userId: "first",
            });
          });
          yield* bootstrapDatabase({ database: database, email: "FIRST@example.test" });
          return yield* getSessionSecurity("old-session", APPLICATION.user);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is revoked", { timeout: 60_000 }, ({ earlierSession }) => {
      expect(earlierSession).toBe(undefined);
    });
  });

  describe("the local bootstrap after a remote one", () => {
    const it = test.extend("bootstrapFailure", async () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapAgain() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              ["first", "second"].map((userId) => ({
                createdAt: new Date(),
                email: `${userId}@example.test`,
                emailVerified: true,
                id: userId,
                name: userId,
                updatedAt: new Date(),
              })),
            );
          });
          yield* bootstrapDatabase({ database: database, email: "first@example.test" });
          return yield* Effect.flip(bootstrapAdmin("second@example.test"));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is unavailable", { timeout: 60_000 }, ({ bootstrapFailure }) => {
      expect(bootstrapFailure).toStrictEqual(new BootstrapUnavailable());
    });
  });
});

describe("the last administrator guard of the migrated database", () => {
  describe.for([
    ["a direct delete", "DELETE FROM user WHERE id = ?"],
    ["a direct demotion", "UPDATE user SET role = 'user' WHERE id = ?"],
  ] as const)("%s of the only administrator", ([, statement]) => {
    const it = test.extend("remainingAdministrator", async () =>
      Effect.runPromise(
        Effect.gen(function* removeLast() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: new Date(),
              email: "first@example.test",
              emailVerified: true,
              id: "first",
              name: "first",
              updatedAt: new Date(),
            });
          });
          yield* bootstrapDatabase({ database: database, email: "first@example.test" });
          yield* Effect.exit(runStatement(statement, "first"));
          return yield* query(async (database) =>
            database.select({ role: user.role }).from(user).where(eq(user.id, "first")),
          );
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is refused by the database", { timeout: 60_000 }, ({ remainingAdministrator }) => {
      expect(remainingAdministrator).toStrictEqual([{ role: "admin" }]);
    });
  });
});
