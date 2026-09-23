import {
  EmptyTestDatabase,
  TestBinding,
  executeD1HttpBatch,
  executeD1RawBatch,
} from "@repo/db-local";
import { DateTime, Effect, ManagedRuntime } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { runRemoteDatabaseCommand } from "../../../../../infra/cloudflare/src/features/cloudflare/remote-command.ts";
import { query } from "./database.ts";
import { remoteDatabase, remoteExecutor } from "./remote-http.ts";
import { RemoteFailure } from "./remote-input.ts";
import { loadRemoteMigrations, migrateDatabase, readMigrationStatus } from "./remote-operations.ts";
import { user } from "./schema.ts";

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "22222222-2222-4222-8222-222222222222",
};

describe("remoteDatabase", () => {
  describe.for([
    [
      "a redirect elsewhere",
      (): Response => HttpResponse.redirect("https://untrusted.example.test/", 302),
    ],
    [
      "an HTTP error that echoes the token",
      (): Response => HttpResponse.json({ error: d1Target.apiToken }, { status: 403 }),
    ],
    [
      "a batch in which a statement failed",
      (): Response =>
        HttpResponse.json({
          result: [{ error: d1Target.apiToken, results: [], success: false }],
          success: true,
        }),
    ],
    ["a body that is not JSON", (): Response => HttpResponse.text(d1Target.apiToken)],
  ] as const)("a D1 API answering with %s", ([, d1Answer]) => {
    const it = test.extend("queryFailure", ({}, { onCleanup }) => {
      const d1Api = setupServer(
        http.post(
          `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/raw`,
          d1Answer,
        ),
      );
      d1Api.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        d1Api.close();
      });
      return Effect.runPromise(
        Effect.flip(
          runRemoteDatabaseCommand(
            ["migrate", "--execute", "--confirm-database", d1Target.databaseId],
            d1Target,
          ),
        ),
      );
    });

    it("fails without carrying the provider body or the token", ({ queryFailure }) => {
      expect(queryFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });
});

describe("a bootstrap plan", () => {
  const it = test
    .extend("migrationList", () =>
      Effect.runPromise(
        Effect.map(loadRemoteMigrations(), (migrations) =>
          migrations.map((migration) => ({ hash: migration.hash, name: migration.name })),
        ),
      ))
    .extend("planReport", ({}, { onCleanup }) => {
      const unreachable = setupServer();
      unreachable.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        unreachable.close();
      });
      return Effect.runPromise(
        runRemoteDatabaseCommand(["bootstrap", "--plan"], {
          ...d1Target,
          email: "private@example.test",
        }),
      );
    });

  it("reports the migrations without touching the network, the token, the account or the email", ({
    migrationList,
    planReport,
  }) => {
    expect(planReport).toStrictEqual({
      databaseId: d1Target.databaseId,
      event: "database.remote_plan",
      migrations: migrationList,
      ok: true,
      operation: "bootstrap",
      remoteStateVerified: false,
    });
  });
});

describe("a database reached over the D1 API", () => {
  const remoteTest = test.extend("remoteD1", ({}, { onCleanup }) => {
    const remoteD1 = ManagedRuntime.make(EmptyTestDatabase);
    const d1Endpoint = `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}`;
    return remoteD1.runPromise(
      Effect.gen(function* serveD1Api() {
        const binding = yield* TestBinding;
        const services = yield* Effect.context();
        const d1Api = setupServer(
          http.post(`${d1Endpoint}/query`, ({ request }) =>
            Effect.runPromiseWith(services)(
              Effect.gen(function* respondToQuery() {
                if (request.headers.get("authorization") !== `Bearer ${d1Target.apiToken}`) {
                  return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
                }
                const requestJson = yield* Effect.promise(() => request.json());
                const executedBatch = yield* executeD1HttpBatch(binding, requestJson);
                return HttpResponse.json(executedBatch as Record<string, unknown>);
              }),
            ),
          ),
          http.post(`${d1Endpoint}/raw`, ({ request }) =>
            Effect.runPromiseWith(services)(
              Effect.gen(function* respondToRaw() {
                if (request.headers.get("authorization") !== `Bearer ${d1Target.apiToken}`) {
                  return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
                }
                const requestJson = yield* Effect.promise(() => request.json());
                return HttpResponse.json(yield* executeD1RawBatch(binding, requestJson));
              }),
            ),
          ),
        );
        d1Api.listen({ onUnhandledRequest: "error" });
        onCleanup(() => {
          d1Api.close();
          return remoteD1.dispose();
        });
        return remoteD1;
      }),
    );
  });

  describe("a migration executed twice through the D1 HTTP batch contract", () => {
    const it = remoteTest.extend("secondReport", ({ remoteD1 }) =>
      remoteD1.runPromise(
        Effect.gen(function* migrateTwice() {
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
          return yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
        }),
      ),
    );

    it("applies nothing the second time", { timeout: 60_000 }, ({ secondReport }) => {
      expect(secondReport).toStrictEqual({
        applied: 0,
        databaseId: d1Target.databaseId,
        event: "database.remote_migrated",
        ok: true,
      });
    });
  });

  describe("a bootstrap executed through the D1 HTTP batch contract", () => {
    const it = remoteTest.extend("promotedUsers", ({ remoteD1 }) =>
      remoteD1.runPromise(
        Effect.gen(function* bootstrapRemote() {
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
          const createdAt = DateTime.toDate(yield* DateTime.now);
          yield* query((database) =>
            database.insert(user).values({
              createdAt,
              email: "private@example.test",
              emailVerified: true,
              id: "first",
              name: "Private Name",
              updatedAt: createdAt,
            }),
          );
          yield* runRemoteDatabaseCommand(["bootstrap", ...execute], {
            ...d1Target,
            email: "private@example.test",
          });
          return yield* query((database) =>
            database.select({ role: user.role, securityVersion: user.securityVersion }).from(user),
          );
        }),
      ),
    );

    it(
      "promotes the verified user and bumps their security version",
      { timeout: 60_000 },
      ({ promotedUsers }) => {
        expect(promotedUsers).toStrictEqual([{ role: "admin", securityVersion: 1 }]);
      },
    );
  });

  describe("the migration status of a database reached over the D1 API", () => {
    const it = remoteTest
      .extend("declaredMigrations", () =>
        Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)),
      )
      .extend("statusBeforeMigrating", ({ remoteD1 }) =>
        remoteD1.runPromise(readMigrationStatus(d1Target)),
      )
      .extend("statusAfterMigrating", ({ remoteD1 }) =>
        remoteD1.runPromise(
          Effect.gen(function* program() {
            const { apply, database } = remoteDatabase(d1Target);
            yield* migrateDatabase({ apply, database });
            return yield* readMigrationStatus(d1Target);
          }),
        ),
      );

    it(
      "leaves every declared migration to apply on an empty database",
      { timeout: 60_000 },
      ({ declaredMigrations, statusBeforeMigrating }) => {
        expect(statusBeforeMigrating).toStrictEqual({
          applied: 0,
          declared: declaredMigrations,
          pending: declaredMigrations,
          state: "recorded",
        });
      },
    );

    it(
      "leaves nothing to apply once every migration ran",
      { timeout: 60_000 },
      ({ declaredMigrations, statusAfterMigrating }) => {
        expect(statusAfterMigrating).toStrictEqual({
          applied: declaredMigrations,
          declared: declaredMigrations,
          pending: 0,
          state: "recorded",
        });
      },
    );
  });

  describe("a database whose tables were made without a recorded history", () => {
    const it = remoteTest
      .extend("declaredMigrations", () =>
        Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)),
      )
      .extend("unrecordedStatus", ({ remoteD1 }) =>
        remoteD1.runPromise(
          Effect.gen(function* program() {
            yield* remoteExecutor(d1Target).batch([
              { params: [], sql: "CREATE TABLE made_by_hand (id TEXT)" },
            ]);
            return yield* readMigrationStatus(d1Target);
          }),
        ),
      )
      .extend("migrationRefusal", ({ remoteD1 }) =>
        remoteD1.runPromise(
          Effect.gen(function* program() {
            yield* remoteExecutor(d1Target).batch([
              { params: [], sql: "CREATE TABLE made_by_hand (id TEXT)" },
            ]);
            const { apply, database } = remoteDatabase(d1Target);
            return yield* Effect.flip(migrateDatabase({ apply, database }));
          }),
        ),
      );

    it(
      "is reported as unrecorded with nothing applied",
      { timeout: 60_000 },
      ({ declaredMigrations, unrecordedStatus }) => {
        expect(unrecordedStatus).toStrictEqual({
          applied: 0,
          declared: declaredMigrations,
          pending: declaredMigrations,
          state: "unrecorded",
        });
      },
    );

    it("refuses to migrate", { timeout: 60_000 }, ({ migrationRefusal }) => {
      expect(migrationRefusal).toStrictEqual(
        new RemoteFailure({ code: "REMOTE_MIGRATION_HISTORY_MISSING" }),
      );
    });
  });
});
