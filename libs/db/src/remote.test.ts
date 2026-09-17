import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { query } from "./index.ts";
import { RemoteFailure } from "./remote-input.ts";
import { parseRemoteInput } from "./remote-input.ts";
import { bootstrapDatabase, loadRemoteMigrations, migrateDatabase } from "./remote-operations.ts";
import type { DatabaseExecutor } from "./remote-operations.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { EmptyTestDatabase, TestBinding } from "./testing.ts";

const target = {
  accountId: "a".repeat(32),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};

const code = <A, R>(effect: Effect.Effect<A, RemoteFailure, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

const tag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );

it.effect(
  "requires explicit execution, exact target confirmation and a non-placeholder database",
  () =>
    Effect.gen(function* () {
      assert.strictEqual(
        yield* code(parseRemoteInput(["migrate"], target)),
        "REMOTE_COMMAND_INVALID",
      );
      assert.strictEqual(
        yield* code(
          parseRemoteInput(
            ["migrate", "--execute", "--confirm-database", target.databaseId],
            target,
          ),
        ),
        "REMOTE_INPUT_INVALID",
      );
      assert.strictEqual(
        yield* code(
          parseRemoteInput(["migrate", "--execute", "--confirm-database", "wrong"], {
            ...target,
            apiToken: "test-token-at-least-20-characters",
          }),
        ),
        "REMOTE_TARGET_MISMATCH",
      );
      assert.strictEqual(
        yield* code(
          parseRemoteInput(["migrate", "--plan"], {
            ...target,
            databaseId: "00000000-0000-0000-0000-000000000001",
          }),
        ),
        "REMOTE_INPUT_INVALID",
      );
      const parsed = yield* parseRemoteInput(["migrate", "--plan"], target);
      assert.strictEqual(parsed.operation, "migrate");
      assert.strictEqual(parsed.execute, false);
    }),
);

it.effect("rejects missing bootstrap identity and surplus commands", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(parseRemoteInput(["bootstrap", "--plan"], target)),
      "REMOTE_INPUT_INVALID",
    );
    assert.strictEqual(
      yield* code(parseRemoteInput(["migrate", "--plan", "extra"], target)),
      "REMOTE_COMMAND_INVALID",
    );
    assert.strictEqual(
      yield* code(
        parseRemoteInput(["bootstrap", "--plan"], { ...target, email: "private-invalid-email" }),
      ),
      "REMOTE_INPUT_INVALID",
    );
  }),
);

it.effect(
  "applies real D1 migrations once, rejects changed history and preserves bootstrap protections",
  () =>
    Effect.gen(function* () {
      const binding = yield* TestBinding;
      const executor: DatabaseExecutor = {
        batch: (queries) =>
          Effect.tryPromise({
            try: () =>
              binding.batch(
                queries.map((statement) =>
                  binding.prepare(statement.sql).bind(...statement.params),
                ),
              ),
            catch: () => new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }),
          }).pipe(Effect.map((result) => result.map((item) => item.results))),
      };
      const migrations = yield* loadRemoteMigrations();
      assert.strictEqual(yield* migrateDatabase(executor, migrations), migrations.length);
      assert.strictEqual(yield* migrateDatabase(executor, migrations), 0);
      const last = migrations.at(-1);
      assert.isDefined(last);
      assert.strictEqual(
        yield* code(
          migrateDatabase(executor, [
            ...migrations,
            {
              hash: "b".repeat(64),
              folderMillis: (last?.folderMillis ?? 0) + 1,
              sql: [
                "CREATE TABLE interrupted_migration (id TEXT)",
                "INSERT INTO missing_migration_table VALUES (1)",
              ],
            },
          ]),
        ),
        "REMOTE_QUERY_FAILED",
      );
      const interrupted = yield* Effect.promise(() =>
        binding
          .prepare("SELECT name FROM sqlite_master WHERE name = ?")
          .bind("interrupted_migration")
          .all(),
      );
      assert.deepStrictEqual(interrupted.results, []);
      const [first, ...rest] = migrations;
      assert.isDefined(first);
      if (first)
        assert.strictEqual(
          yield* code(migrateDatabase(executor, [{ ...first, hash: "c".repeat(64) }, ...rest])),
          "REMOTE_MIGRATION_HISTORY_MISMATCH",
        );
      for (const [id, verified] of [
        ["unverified", false],
        ["first", true],
        ["second", true],
      ] as const)
        yield* query((database) =>
          database.insert(user).values({
            id,
            name: id,
            email: `${id}@example.test`,
            emailVerified: verified,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );
      for (const email of ["unverified@example.test", "missing@example.test"])
        assert.strictEqual(
          yield* code(bootstrapDatabase(executor, email)),
          "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
        );
      yield* query((database) =>
        database.insert(session).values({
          id: "old-session",
          token: "old-token",
          userId: "first",
          audience: "user",
          securityVersion: 0,
          authenticationMethod: "password",
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        }),
      );
      yield* bootstrapDatabase(executor, "FIRST@example.test");
      assert.isNull(yield* getSessionSecurity("old-session", "user"));
      assert.strictEqual(
        yield* code(bootstrapDatabase(executor, "second@example.test")),
        "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN",
      );
      assert.strictEqual(yield* tag(bootstrapAdmin("second@example.test")), "BootstrapUnavailable");
      for (const statement of [
        "DELETE FROM user WHERE id = ?",
        "UPDATE user SET role = 'user' WHERE id = ?",
      ]) {
        const failure = yield* Effect.tryPromise(() =>
          binding.prepare(statement).bind("first").run(),
        ).pipe(Effect.flip);
        assert.include(String(failure.cause), "LAST_ADMIN_REQUIRED");
      }
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: 60_000 },
);
