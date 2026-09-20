import {
  EmptyTestDatabase,
  TestBinding,
  databaseObjectNames,
  describeDatabase,
  primaryKeyNullability,
  runStatement,
} from "@repo/db-local";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/payload/sqlite";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { loadRemoteMigrations, migrateD1 } from "./remote-operations.ts";
import { schema } from "./schema.ts";

const snapshots: Readonly<Record<string, Parameters<typeof generateMigration>[0]>> =
  import.meta.glob("../migrations/*/snapshot.json", { eager: true, import: "default" });

describe("the applied migrations", () => {
  describe("compared with a database built from the models alone", () => {
    const it = test
      .extend("appliedDatabase", async () =>
        Effect.runPromise(
          Effect.gen(function* fromMigrations() {
            yield* migrateD1(yield* TestBinding);
            return yield* describeDatabase();
          }).pipe(Effect.provide(EmptyTestDatabase)),
        ))
      .extend("modelledDatabase", async () =>
        Effect.runPromise(
          Effect.gen(function* fromModels() {
            const modelled = yield* Effect.promise(async () =>
              generateMigration(await generateDrizzleJson({}), await generateDrizzleJson(schema)),
            );
            yield* Effect.forEach(modelled, (statement) => runStatement(statement), {
              discard: true,
            });
            return yield* describeDatabase();
          }).pipe(Effect.provide(EmptyTestDatabase)),
        ),
      );

    it(
      "carry the same tables, columns, indexes and keys, plus the triggers and strict keys only migrations add",
      { timeout: 60_000 },
      ({ appliedDatabase, modelledDatabase }) => {
        expect(modelledDatabase).toStrictEqual({
          ...appliedDatabase,
          primaryKeyNotNull: [0, 1],
          triggers: [],
        });
      },
    );
  });

  describe("the triggers they install", () => {
    const it = test.extend("appliedTriggers", async () =>
      Effect.runPromise(
        Effect.gen(function* triggersOf() {
          yield* migrateD1(yield* TestBinding);
          return yield* databaseObjectNames("trigger");
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("guard sessions, pending sign-ups, invites, the last owner and the last editor", ({
      appliedTriggers,
    }) => {
      expect(appliedTriggers).toStrictEqual([
        "invite_accept_once",
        "session_insert_current_version",
        "session_update_current_version",
        "user_delete_pending_auth",
        "user_keep_last_admin_delete",
        "user_keep_last_admin_update",
        "user_keep_last_editor_delete",
        "user_keep_last_editor_update",
        "user_role_revoke_oauth_grants",
        "user_role_revoke_sessions",
        "user_state_revoke_sessions",
      ]);
    });
  });

  describe("the primary keys they declare", () => {
    const it = test.extend("primaryKeyNotNull", async () =>
      Effect.runPromise(
        Effect.gen(function* primaryKeysOf() {
          yield* migrateD1(yield* TestBinding);
          return yield* primaryKeyNullability();
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it("are all declared not null", ({ primaryKeyNotNull }) => {
      expect(primaryKeyNotNull).toStrictEqual([1]);
    });
  });
});

describe("the models", () => {
  describe("compared with the latest migration snapshot", () => {
    const it = test.extend("pendingStatements", async () => {
      const latestMigration = (await Effect.runPromise(loadRemoteMigrations())).at(-1);
      const applied =
        latestMigration === undefined
          ? undefined
          : snapshots[`../migrations/${latestMigration.name}/snapshot.json`];
      return applied === undefined
        ? ["no migration snapshot found"]
        : generateMigration(applied, await generateDrizzleJson(schema));
    });

    it("need no further migration", ({ pendingStatements }) => {
      expect(pendingStatements).toStrictEqual([]);
    });
  });
});
