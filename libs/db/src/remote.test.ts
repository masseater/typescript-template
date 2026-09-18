import {
  CloudflareInternalTestDatabase,
  EmptyTestDatabase,
  TestBinding,
  d1Executor,
  runStatement,
} from "./testing-node.ts";
import { assert, it } from "@effect/vitest";
import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import { session, user } from "./schema.ts";
import type { Database } from "./database.ts";
import { Effect } from "effect";
import type { RemoteFailure } from "./remote-input.ts";
import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { getSessionSecurity } from "./security.ts";
import { parseRemoteInput } from "./remote-input.ts";
import { query } from "./database.ts";

const HEX_ID_LENGTH = 32;
const HASH_LENGTH = 64;
const SESSION_LIFETIME_MS = 60_000;
const TEST_TIMEOUT_MS = 60_000;

const target = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};
const executeFlags = ["--execute", "--confirm-database"] as const;

function code<Value, Requirements>(
  effect: Effect.Effect<Value, RemoteFailure, Requirements>,
): Effect.Effect<RemoteFailure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

function tag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

function insertUser(id: string, verified: boolean): Effect.Effect<void, unknown, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${id}@example.test`,
      emailVerified: verified,
      id,
      name: id,
      updatedAt: new Date(),
    });
  });
}

function insertSession(id: string, userId: string): Effect.Effect<void, unknown, Database> {
  return query(async (database): Promise<void> => {
    await database.insert(session).values({
      audience: "user",
      authenticationMethod: "password",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      id,
      securityVersion: 0,
      token: `${id}-token`,
      updatedAt: new Date(),
      userId,
    });
  });
}

it.effect("requires explicit execution and exact target confirmation", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate"], target)),
      "REMOTE_COMMAND_INVALID",
    );
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate", ...executeFlags, target.databaseId], target)),
      "REMOTE_INPUT_INVALID",
    );
    const withToken = { ...target, apiToken: "test-token-at-least-20-characters" };
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate", ...executeFlags, "wrong"], withToken)),
      "REMOTE_TARGET_MISMATCH",
    );
  }),
);

it.effect("refuses placeholder databases and accepts a plan", () =>
  Effect.gen(function* program() {
    const placeholder = { ...target, databaseId: "00000000-0000-0000-0000-000000000001" };
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate", "--plan"], placeholder)),
      "REMOTE_INPUT_INVALID",
    );
    const parsed = yield* parseRemoteInput(["migrate", "--plan"], target);
    assert.strictEqual(parsed.operation, "migrate");
    assert.isFalse(parsed.execute);
  }),
);

it.effect("rejects missing bootstrap identity and surplus commands", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(parseRemoteInput(["bootstrap", "--plan"], target)),
      "REMOTE_INPUT_INVALID",
    );
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate", "--plan", "extra"], target)),
      "REMOTE_COMMAND_INVALID",
    );
    const invalidEmail = { ...target, email: "private-invalid-email" };
    assert.strictEqual(
      yield* code(parseRemoteInput(["bootstrap", "--plan"], invalidEmail)),
      "REMOTE_INPUT_INVALID",
    );
  }),
);

it.effect(
  "applies real D1 migrations once and rolls back an interrupted migration",
  () =>
    Effect.gen(function* program() {
      const executor = d1Executor(yield* TestBinding);
      const migrations = yield* loadRemoteMigrations();
      assert.strictEqual(yield* migrateDatabase(executor, migrations), migrations.length);
      assert.strictEqual(yield* migrateDatabase(executor, migrations), 0);
      const folderMillis = (migrations.at(-1)?.folderMillis ?? 0) + 1;
      const interruptedMigration = {
        folderMillis,
        hash: "b".repeat(HASH_LENGTH),
        name: "99999999999999_interrupted",
        sql: [
          "CREATE TABLE interrupted_migration (id TEXT)",
          "INSERT INTO missing_migration_table VALUES (1)",
        ],
      };
      assert.strictEqual(
        yield* code(migrateDatabase(executor, [...migrations, interruptedMigration])),
        "REMOTE_QUERY_FAILED",
      );
      const interrupted = yield* runStatement(
        "SELECT name FROM sqlite_master WHERE name = ?",
        "interrupted_migration",
      );
      assert.deepStrictEqual(interrupted.results, []);
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "rejects migrations whose applied history changed",
  () =>
    Effect.gen(function* program() {
      const executor = d1Executor(yield* TestBinding);
      const migrations = yield* loadRemoteMigrations();
      yield* migrateDatabase(executor, migrations);
      const [first, ...rest] = migrations;
      const changed =
        first === undefined ? [] : [{ ...first, hash: "c".repeat(HASH_LENGTH) }, ...rest];
      assert.strictEqual(
        yield* code(migrateDatabase(executor, changed)),
        "REMOTE_MIGRATION_HISTORY_MISMATCH",
      );
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "bootstraps only one verified administrator and revokes their earlier sessions",
  () =>
    Effect.gen(function* program() {
      const executor = d1Executor(yield* TestBinding);
      yield* migrateDatabase(executor, yield* loadRemoteMigrations());
      yield* Effect.all([
        insertUser("unverified", false),
        insertUser("first", true),
        insertUser("second", true),
      ]);
      for (const email of ["unverified@example.test", "missing@example.test"]) {
        assert.strictEqual(
          yield* code(bootstrapDatabase(executor, email)),
          "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
        );
      }
      yield* insertSession("old-session", "first");
      yield* bootstrapDatabase(executor, "FIRST@example.test");
      assert.isNull(yield* getSessionSecurity("old-session", "user"));
      assert.strictEqual(
        yield* code(bootstrapDatabase(executor, "second@example.test")),
        "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
      );
      assert.strictEqual(yield* tag(bootstrapAdmin("second@example.test")), "BootstrapUnavailable");
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "the database refuses to delete or demote the last administrator",
  () =>
    Effect.gen(function* program() {
      const executor = d1Executor(yield* TestBinding);
      yield* migrateDatabase(executor, yield* loadRemoteMigrations());
      yield* insertUser("first", true);
      yield* bootstrapDatabase(executor, "first@example.test");
      for (const statement of [
        "DELETE FROM user WHERE id = ?",
        "UPDATE user SET role = 'user' WHERE id = ?",
      ]) {
        const failure = yield* runStatement(statement, "first").pipe(Effect.flip);
        assert.instanceOf(failure, Error);
        assert.include(
          String(failure instanceof Error ? failure.cause : failure),
          "LAST_ADMIN_REQUIRED",
        );
      }
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "migrates a database that holds only the Cloudflare internal tables",
  () =>
    Effect.gen(function* program() {
      const internal = yield* runStatement(
        "SELECT name FROM sqlite_master WHERE name = ?",
        "_cf_KV",
      );
      assert.deepStrictEqual(internal.results, [{ name: "_cf_KV" }]);
      const executor = d1Executor(yield* TestBinding);
      const migrations = yield* loadRemoteMigrations();
      assert.strictEqual(yield* migrateDatabase(executor, migrations), migrations.length);
    }).pipe(Effect.provide(CloudflareInternalTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);

it.effect(
  "refuses to migrate application tables that have no recorded history",
  () =>
    Effect.gen(function* program() {
      yield* runStatement("CREATE TABLE user (id TEXT PRIMARY KEY)");
      const executor = d1Executor(yield* TestBinding);
      const migrations = yield* loadRemoteMigrations();
      assert.strictEqual(
        yield* code(migrateDatabase(executor, migrations)),
        "REMOTE_MIGRATION_HISTORY_MISSING",
      );
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: TEST_TIMEOUT_MS },
);
