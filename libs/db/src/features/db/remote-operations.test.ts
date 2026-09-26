import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { APPLICATION, AUTHENTICATION_METHOD } from "@repo/config";
import { EmptyTestDatabase, TestBinding, deployMigrations, runStatement } from "@repo/db-local";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { DateTime, Effect, FileSystem, Path } from "effect";

import { bootstrapAdmin, BootstrapUnavailable } from "./bootstrap-statement.ts";
import { query } from "./database.ts";
import {
  RemoteFailure,
  bootstrapDatabase,
  loadRemoteMigrations,
  migrateD1,
  migrationsFolder,
} from "./remote-operations.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

const TIMEOUT = 60_000;

const copiedMigrations = Effect.gen(function* copyMigrations() {
  const filesystem = yield* FileSystem.FileSystem;
  const folder = yield* filesystem.makeTempDirectoryScoped({ prefix: "template-migrations-" });
  yield* filesystem.copy(migrationsFolder, folder);
  return folder;
});

describe("migrateD1", () => {
  it.live(
    "applies every migration on a first migration of an empty database",
    () =>
      Effect.gen(function* migrateOnce() {
        const migrations = yield* loadRemoteMigrations();
        const appliedCount = yield* migrateD1(yield* TestBinding);
        assert.strictEqual(appliedCount, migrations.length);
      }).pipe(Effect.provide(EmptyTestDatabase)),
    TIMEOUT,
  );

  it.live(
    "applies nothing on a second migration of an up to date database",
    () =>
      Effect.gen(function* migrateTwice() {
        const binding = yield* TestBinding;
        yield* migrateD1(binding);
        assert.strictEqual(yield* migrateD1(binding), 0);
      }).pipe(Effect.provide(EmptyTestDatabase)),
    TIMEOUT,
  );

  it.live(
    "fails as a query failure when the second statement of a migration fails",
    () =>
      Effect.gen(function* interrupt() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const folder = yield* copiedMigrations;
        const interrupted = paths.join(folder, "99999999999999_interrupted");
        yield* filesystem.makeDirectory(interrupted);
        yield* filesystem.writeFileString(
          paths.join(interrupted, "migration.sql"),
          "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
        );
        const binding = yield* TestBinding;
        yield* migrateD1(binding);
        const migrationFailure = yield* Effect.flip(migrateD1(binding, folder));
        assert.deepStrictEqual(
          migrationFailure,
          new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
        );
      }).pipe(Effect.scoped, Effect.provide([EmptyTestDatabase, NodeServices.layer])),
    TIMEOUT,
  );

  it.live(
    "keeps nothing of a migration whose second statement failed",
    () =>
      Effect.gen(function* interrupt() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const folder = yield* copiedMigrations;
        const interrupted = paths.join(folder, "99999999999999_interrupted");
        yield* filesystem.makeDirectory(interrupted);
        yield* filesystem.writeFileString(
          paths.join(interrupted, "migration.sql"),
          "CREATE TABLE interrupted_migration (id TEXT);\n--> statement-breakpoint\nINSERT INTO missing_migration_table VALUES (1);",
        );
        const binding = yield* TestBinding;
        yield* migrateD1(binding);
        yield* Effect.exit(migrateD1(binding, folder));
        const listing = yield* runStatement(
          "SELECT name FROM sqlite_master WHERE name = ?",
          "interrupted_migration",
        );
        assert.deepStrictEqual(listing.results, []);
      }).pipe(Effect.scoped, Effect.provide([EmptyTestDatabase, NodeServices.layer])),
    TIMEOUT,
  );

  it.live(
    "refuses migrations whose already applied history changed",
    () =>
      Effect.gen(function* rewriteHistory() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const folder = yield* copiedMigrations;
        const binding = yield* TestBinding;
        const [first] = yield* loadRemoteMigrations();
        yield* migrateD1(binding);
        assert.isDefined(first);
        yield* filesystem.writeFileString(paths.join(folder, first.name, "migration.sql"), "\n", {
          flag: "a",
        });
        const migrationFailure = yield* Effect.flip(migrateD1(binding, folder));
        assert.deepStrictEqual(
          migrationFailure,
          new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISMATCH" }),
        );
      }).pipe(Effect.scoped, Effect.provide([EmptyTestDatabase, NodeServices.layer])),
    TIMEOUT,
  );

  it.live(
    "refuses a database carrying application tables without a recorded history",
    () =>
      Effect.gen(function* migrateUnrecorded() {
        yield* runStatement("CREATE TABLE user (id TEXT PRIMARY KEY)");
        const migrationFailure = yield* Effect.flip(migrateD1(yield* TestBinding));
        assert.deepStrictEqual(
          migrationFailure,
          new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISSING" }),
        );
      }).pipe(Effect.provide(EmptyTestDatabase)),
    TIMEOUT,
  );
});

describe("bootstrapDatabase", () => {
  describe.for([
    ["an unverified user", "unverified@example.test"],
    ["a user who does not exist", "missing@example.test"],
    ["a second verified user after the first was promoted", "second@example.test"],
  ] as const)("%s", ([, email]) => {
    it.live(
      "is refused",
      () =>
        Effect.gen(function* bootstrapOther() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* deployMigrations(binding);
          const seededAt = DateTime.toDate(yield* DateTime.now);
          yield* query((database) =>
            database.insert(user).values(
              [
                { id: "unverified", verified: false },
                { id: "first", verified: true },
                { id: "second", verified: true },
              ].map((seeded) => ({
                createdAt: seededAt,
                email: `${seeded.id}@example.test`,
                emailVerified: seeded.verified,
                id: seeded.id,
                name: seeded.id,
                updatedAt: seededAt,
              })),
            ),
          );
          yield* bootstrapDatabase({ database: database, email: "FIRST@example.test" });
          const bootstrapFailure = yield* Effect.flip(
            bootstrapDatabase({ database: database, email: email }),
          );
          assert.deepStrictEqual(
            bootstrapFailure,
            new RemoteFailure({ code: "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN" }),
          );
        }).pipe(Effect.provide(EmptyTestDatabase)),
      TIMEOUT,
    );
  });

  it.live(
    "revokes the session a user opened before being promoted",
    () =>
      Effect.gen(function* promoteFirst() {
        const binding = yield* TestBinding;
        const database = drizzle(binding);
        yield* deployMigrations(binding);
        const openedAt = yield* DateTime.now;
        const seededAt = DateTime.toDate(openedAt);
        yield* query((database) =>
          database.batch([
            database.insert(user).values({
              createdAt: seededAt,
              email: "first@example.test",
              emailVerified: true,
              id: "first",
              name: "first",
              updatedAt: seededAt,
            }),
            database.insert(session).values({
              audience: APPLICATION.user,
              authenticationMethod: AUTHENTICATION_METHOD.password,
              createdAt: seededAt,
              expiresAt: DateTime.toDate(DateTime.add(openedAt, { minutes: 1 })),
              id: "old-session",
              securityVersion: 0,
              token: "old-session-token",
              updatedAt: seededAt,
              userId: "first",
            }),
          ]),
        );
        yield* bootstrapDatabase({ database: database, email: "FIRST@example.test" });
        assert.isUndefined(yield* getSessionSecurity("old-session", APPLICATION.user));
      }).pipe(Effect.provide(EmptyTestDatabase)),
    TIMEOUT,
  );

  it.live(
    "makes the local bootstrap unavailable after a remote one",
    () =>
      Effect.gen(function* bootstrapAgain() {
        const binding = yield* TestBinding;
        const database = drizzle(binding);
        yield* deployMigrations(binding);
        const seededAt = DateTime.toDate(yield* DateTime.now);
        yield* query((database) =>
          database.insert(user).values(
            ["first", "second"].map((userId) => ({
              createdAt: seededAt,
              email: `${userId}@example.test`,
              emailVerified: true,
              id: userId,
              name: userId,
              updatedAt: seededAt,
            })),
          ),
        );
        yield* bootstrapDatabase({ database: database, email: "first@example.test" });
        const bootstrapFailure = yield* Effect.flip(bootstrapAdmin("second@example.test"));
        assert.deepStrictEqual(bootstrapFailure, new BootstrapUnavailable());
      }).pipe(Effect.provide(EmptyTestDatabase)),
    TIMEOUT,
  );
});

describe("the last administrator guard of the migrated database", () => {
  describe.for([
    ["a direct delete", "DELETE FROM user WHERE id = ?"],
    ["a direct demotion", "UPDATE user SET role = 'member' WHERE id = ?"],
  ] as const)("%s of the only administrator", ([, statement]) => {
    it.live(
      "is refused by the database",
      () =>
        Effect.gen(function* removeLast() {
          const binding = yield* TestBinding;
          const database = drizzle(binding);
          yield* deployMigrations(binding);
          const seededAt = DateTime.toDate(yield* DateTime.now);
          yield* query((database) =>
            database.insert(user).values({
              createdAt: seededAt,
              email: "first@example.test",
              emailVerified: true,
              id: "first",
              name: "first",
              updatedAt: seededAt,
            }),
          );
          yield* bootstrapDatabase({ database: database, email: "first@example.test" });
          yield* Effect.exit(runStatement(statement, "first"));
          const remainingAdministrator = yield* query((database) =>
            database.select({ role: user.role }).from(user).where(eq(user.id, "first")),
          );
          assert.deepStrictEqual(remainingAdministrator, [{ role: "admin" }]);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      TIMEOUT,
    );
  });
});
