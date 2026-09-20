import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { remoteExecutor } from "./remote-http.ts";
import { RemoteFailure } from "./remote-input.ts";
import { loadRemoteMigrations, migrateDatabase, readMigrationStatus } from "./remote-operations.ts";
import { EmptyTestDatabase, TestBinding, executeD1HttpBatch } from "./testing-node.ts";

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "22222222-2222-4222-8222-222222222222",
};

describe("remoteExecutor", () => {
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
    const it = test.extend("queryFailure", async ({}, { onCleanup }) => {
      const d1Api = setupServer(
        http.post(
          `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/query`,
          d1Answer,
        ),
      );
      d1Api.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        d1Api.close();
      });
      return Effect.runPromise(
        Effect.flip(remoteExecutor(d1Target).batch([{ params: [], sql: "SELECT 1" }])),
      );
    });

    it("fails without carrying the provider body or the token", ({ queryFailure }) => {
      expect(queryFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });
});

const d1QueryEndpoint = `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/query`;

describe("the migration status of a database reached over the D1 API", () => {
  const it = test
    .extend("declaredMigrations", async () =>
      Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)))
    .extend("statusBeforeMigrating", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* program() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1QueryEndpoint, async ({ request }) =>
              HttpResponse.json(await executeD1HttpBatch(binding, await request.json())),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          return yield* readMigrationStatus(d1Target);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ),
    )
    .extend("statusAfterMigrating", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* program() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1QueryEndpoint, async ({ request }) =>
              HttpResponse.json(await executeD1HttpBatch(binding, await request.json())),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          yield* migrateDatabase(remoteExecutor(d1Target), yield* loadRemoteMigrations());
          return yield* readMigrationStatus(d1Target);
        }).pipe(Effect.provide(EmptyTestDatabase)),
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
  const it = test
    .extend("declaredMigrations", async () =>
      Effect.runPromise(Effect.map(loadRemoteMigrations(), (migrations) => migrations.length)))
    .extend("unrecordedStatus", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* program() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1QueryEndpoint, async ({ request }) =>
              HttpResponse.json(await executeD1HttpBatch(binding, await request.json())),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          yield* remoteExecutor(d1Target).batch([
            { params: [], sql: "CREATE TABLE made_by_hand (id TEXT)" },
          ]);
          return yield* readMigrationStatus(d1Target);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ),
    )
    .extend("migrationRefusal", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* program() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1QueryEndpoint, async ({ request }) =>
              HttpResponse.json(await executeD1HttpBatch(binding, await request.json())),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          yield* remoteExecutor(d1Target).batch([
            { params: [], sql: "CREATE TABLE made_by_hand (id TEXT)" },
          ]);
          return yield* Effect.flip(
            migrateDatabase(remoteExecutor(d1Target), yield* loadRemoteMigrations()),
          );
        }).pipe(Effect.provide(EmptyTestDatabase)),
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
