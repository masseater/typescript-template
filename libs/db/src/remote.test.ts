import { EmptyTestDatabase, TestBinding, failureCode, runStatement } from "./testing-node.ts";
import { assert, it } from "@effect/vitest";
import { bootstrapDatabase, migrateD1 } from "./remote-operations.ts";
import { session, user } from "./schema.ts";
import type { Database } from "./database.ts";
import { Effect } from "effect";
import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { drizzle } from "drizzle-orm/d1";
import { getSessionSecurity } from "./security.ts";
import { parseRemoteInput } from "./remote-input.ts";
import { query } from "./database.ts";

const HEX_ID_LENGTH = 32;
const SESSION_LIFETIME_MS = 60_000;
const TEST_TIMEOUT_MS = 60_000;

const target = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};
const executeFlags = ["--execute", "--confirm-database"] as const;

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
      yield* failureCode(parseRemoteInput(["migrate"], target)),
      "REMOTE_COMMAND_INVALID",
    );
    assert.strictEqual(
      yield* failureCode(parseRemoteInput(["migrate", ...executeFlags, target.databaseId], target)),
      "REMOTE_INPUT_INVALID",
    );
    const withToken = { ...target, apiToken: "test-token-at-least-20-characters" };
    assert.strictEqual(
      yield* failureCode(parseRemoteInput(["migrate", ...executeFlags, "wrong"], withToken)),
      "REMOTE_TARGET_MISMATCH",
    );
  }),
);

it.effect("refuses placeholder databases and accepts a plan", () =>
  Effect.gen(function* program() {
    const placeholder = { ...target, databaseId: "00000000-0000-0000-0000-000000000001" };
    assert.strictEqual(
      yield* failureCode(parseRemoteInput(["migrate", "--plan"], placeholder)),
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
      yield* failureCode(parseRemoteInput(["bootstrap", "--plan"], target)),
      "REMOTE_INPUT_INVALID",
    );
    assert.strictEqual(
      yield* failureCode(parseRemoteInput(["migrate", "--plan", "extra"], target)),
      "REMOTE_COMMAND_INVALID",
    );
    const invalidEmail = { ...target, email: "private-invalid-email" };
    assert.strictEqual(
      yield* failureCode(parseRemoteInput(["bootstrap", "--plan"], invalidEmail)),
      "REMOTE_INPUT_INVALID",
    );
  }),
);

it.effect(
  "bootstraps only one verified administrator and revokes their earlier sessions",
  () =>
    Effect.gen(function* program() {
      const database = drizzle(yield* TestBinding);
      yield* migrateD1(database.$client);
      yield* Effect.all([
        insertUser("unverified", false),
        insertUser("first", true),
        insertUser("second", true),
      ]);
      for (const email of ["unverified@example.test", "missing@example.test"]) {
        assert.strictEqual(
          yield* failureCode(bootstrapDatabase(database, email)),
          "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
        );
      }
      yield* insertSession("old-session", "first");
      yield* bootstrapDatabase(database, "FIRST@example.test");
      assert.isNull(yield* getSessionSecurity("old-session", "user"));
      assert.strictEqual(
        yield* failureCode(bootstrapDatabase(database, "second@example.test")),
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
      const binding = yield* TestBinding;
      yield* migrateD1(binding);
      yield* insertUser("first", true);
      yield* bootstrapDatabase(drizzle(binding), "first@example.test");
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
