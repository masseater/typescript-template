import { DatabaseSync } from "node:sqlite";

import { NodeServices } from "@effect/platform-node";
import { EmptyTestDatabase, TestBinding, runStatement } from "@repo/db-local";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { bootstrapAdmin } from "./bootstrap-statement.ts";
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

import type { Scope } from "effect";

const changedMigrations = (
  change: (folder: string) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>,
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Effect.gen(function* copyMigrations() {
    const filesystem = yield* FileSystem.FileSystem;
    const folder = yield* filesystem.makeTempDirectoryScoped({ prefix: "template-migrations-" });
    yield* filesystem.copy(migrationsFolder, folder);
    yield* change(folder);
    return folder;
  }).pipe(Effect.orDie);

const wallDate = (): Date => DateTime.toDate(DateTime.nowUnsafe());

const seedUser = (seeded: {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly emailVerified?: boolean;
}) => ({
  createdAt: wallDate(),
  email: seeded.email,
  emailVerified: seeded.emailVerified ?? true,
  id: seeded.id,
  name: seeded.name,
  updatedAt: wallDate(),
});

describe("migrateD1", () => {
  describe("a first migration of an empty database", () => {
    const it = test
      .extend("migrationCount", () =>
        Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)))
      .extend("appliedCount", () =>
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
    const it = test.extend("appliedCount", () =>
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
    const it = test.extend("migrationFailure", () =>
      Effect.runPromise(
        Effect.gen(function* interrupt() {
          const binding = yield* TestBinding;
          yield* migrateD1(binding);
          const folder = yield* changedMigrations((migrations) =>
            Effect.gen(function* writeInterrupted() {
              const filesystem = yield* FileSystem.FileSystem;
              const hostPath = yield* Path.Path;
              const interrupted = hostPath.join(migrations, "99999999999999_interrupted");
              yield* filesystem.makeDirectory(interrupted);
              yield* filesystem.writeFileString(
                hostPath.join(interrupted, "migration.sql"),
                "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
              );
            }),
          );
          return yield* Effect.flip(migrateD1(binding, folder));
        }).pipe(Effect.scoped, Effect.provide(Layer.merge(EmptyTestDatabase, NodeServices.layer))),
      ));

    it("fails as a query failure", { timeout: 60_000 }, ({ migrationFailure }) => {
      expect(migrationFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });

  describe("the database after a migration whose second statement failed", () => {
    const it = test.extend("interruptedTables", () =>
      Effect.runPromise(
        Effect.gen(function* interrupt() {
          const binding = yield* TestBinding;
          yield* migrateD1(binding);
          const folder = yield* changedMigrations((migrations) =>
            Effect.gen(function* writeInterrupted() {
              const filesystem = yield* FileSystem.FileSystem;
              const hostPath = yield* Path.Path;
              const interrupted = hostPath.join(migrations, "99999999999999_interrupted");
              yield* filesystem.makeDirectory(interrupted);
              yield* filesystem.writeFileString(
                hostPath.join(interrupted, "migration.sql"),
                "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
              );
            }),
          );
          yield* Effect.exit(migrateD1(binding, folder));
          const listing = yield* runStatement(
            "SELECT name FROM sqlite_master WHERE name = ?",
            "interrupted_migration",
          );
          return listing.results;
        }).pipe(Effect.scoped, Effect.provide(Layer.merge(EmptyTestDatabase, NodeServices.layer))),
      ));

    it("keeps nothing of the failed migration", { timeout: 60_000 }, ({ interruptedTables }) => {
      expect(interruptedTables).toStrictEqual([]);
    });
  });

  describe("migrations whose already applied history changed", () => {
    const it = test.extend("migrationFailure", () =>
      Effect.runPromise(
        Effect.gen(function* rewriteHistory() {
          const binding = yield* TestBinding;
          const [first] = yield* loadRemoteMigrations();
          yield* migrateD1(binding);
          if (first === undefined) {
            return new RemoteFailure({ code: "REMOTE_MIGRATIONS_INVALID" });
          }
          const folder = yield* changedMigrations((migrations) =>
            Effect.gen(function* appendHistory() {
              const filesystem = yield* FileSystem.FileSystem;
              const hostPath = yield* Path.Path;
              yield* filesystem.writeFileString(
                hostPath.join(migrations, first.name, "migration.sql"),
                "\n",
                { flag: "a" },
              );
            }),
          );
          return yield* Effect.flip(migrateD1(binding, folder));
        }).pipe(Effect.scoped, Effect.provide(Layer.merge(EmptyTestDatabase, NodeServices.layer))),
      ));

    it("are refused", { timeout: 60_000 }, ({ migrationFailure }) => {
      expect(migrationFailure).toStrictEqual(
        new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" }),
      );
    });
  });

  describe("a database carrying application tables without a recorded history", () => {
    const it = test.extend("migrationFailure", () =>
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
    const it = test.extend("bootstrapFailure", () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapOther() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query((database) =>
            database
              .insert(user)
              .values(
                [
                  { id: "unverified", verified: false },
                  { id: "first", verified: true },
                  { id: "second", verified: true },
                ].map((seeded) =>
                  seedUser({
                    email: `${seeded.id}@example.test`,
                    emailVerified: seeded.verified,
                    id: seeded.id,
                    name: seeded.id,
                  }),
                ),
              )
              .then(() => undefined),
          );
          yield* bootstrapDatabase(database, "FIRST@example.test");
          return yield* Effect.flip(bootstrapDatabase(database, email));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is refused", { timeout: 60_000 }, ({ bootstrapFailure }) => {
      expect(bootstrapFailure).toStrictEqual(
        new RemoteFailure({ code: "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN" }),
      );
    });
  });

  describe("the session a user opened before being promoted", () => {
    const it = test.extend("earlierSession", () =>
      Effect.runPromise(
        Effect.gen(function* promoteFirst() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          const createdAt = wallDate();
          yield* query((database) =>
            database
              .insert(user)
              .values(
                seedUser({
                  email: "first@example.test",
                  id: "first",
                  name: "first",
                }),
              )
              .then(() => undefined),
          );
          yield* query((database) =>
            database
              .insert(session)
              .values({
                audience: "service-member",
                authenticationMethod: "password",
                createdAt,
                expiresAt: DateTime.toDate(
                  DateTime.makeUnsafe(DateTime.toEpochMillis(DateTime.nowUnsafe()) + 60_000),
                ),
                id: "old-session",
                securityVersion: 0,
                token: "old-session-token",
                updatedAt: createdAt,
                userId: "first",
              })
              .then(() => undefined),
          );
          yield* bootstrapDatabase(database, "FIRST@example.test");
          return yield* getSessionSecurity("old-session", "service-member");
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is revoked", { timeout: 60_000 }, ({ earlierSession }) => {
      expect(earlierSession).toBeUndefined();
    });
  });

  describe("the local bootstrap after a remote one", () => {
    const it = test.extend("bootstrapFailure", () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapAgain() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query((database) =>
            database
              .insert(user)
              .values(
                ["first", "second"].map((userId) =>
                  seedUser({
                    email: `${userId}@example.test`,
                    id: userId,
                    name: userId,
                  }),
                ),
              )
              .then(() => undefined),
          );
          yield* bootstrapDatabase(database, "first@example.test");
          return yield* Effect.flip(bootstrapAdmin("second@example.test"));
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is unavailable", { timeout: 60_000 }, ({ bootstrapFailure }) => {
      expect(bootstrapFailure).toMatchObject({ _tag: "BootstrapUnavailable" });
    });
  });
});

describe("the last administrator guard of the migrated database", () => {
  describe.for([
    ["a direct delete", "DELETE FROM user WHERE id = ?"],
    ["a direct demotion", "UPDATE user SET role = 'user' WHERE id = ?"],
  ] as const)("%s of the only administrator", ([, statement]) => {
    const it = test.extend("remainingAdministrator", () =>
      Effect.runPromise(
        Effect.gen(function* removeLast() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* migrateD1(binding);
          yield* query((database) =>
            database
              .insert(user)
              .values(
                seedUser({
                  email: "first@example.test",
                  id: "first",
                  name: "first",
                }),
              )
              .then(() => undefined),
          );
          yield* bootstrapDatabase(database, "first@example.test");
          yield* Effect.exit(runStatement(statement, "first"));
          return yield* query((database) =>
            database.select({ role: user.role }).from(user).where(eq(user.id, "first")),
          );
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("is refused by the database", { timeout: 60_000 }, ({ remainingAdministrator }) => {
      expect(remainingAdministrator).toStrictEqual([{ role: "admin" }]);
    });
  });
});
