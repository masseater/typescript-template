import { query, schema } from "@repo/db";
import { RemoteFailure, loadRemoteMigrations, migrateD1 } from "@repo/db/migrations";
import {
  EmptyTestDatabase,
  TestBinding,
  deployMigrations,
  executeD1RawBatch,
} from "@repo/db/node-testing";
import { DateTime, Effect, ManagedRuntime } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { runRemoteDatabaseCommand } from "./remote-command.ts";

const { user } = schema;

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "22222222-2222-4222-8222-222222222222",
};

describe("the remote database connection", () => {
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
            ["bootstrap", "--execute", "--confirm-database", d1Target.databaseId],
            { ...d1Target, email: "private@example.test" },
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

  describe("a bootstrap executed through the D1 HTTP batch contract", () => {
    const it = remoteTest.extend("promotedUsers", ({ remoteD1 }) =>
      remoteD1.runPromise(
        Effect.gen(function* bootstrapRemote() {
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          yield* deployMigrations(yield* TestBinding);
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

  describe("a bootstrap before the deployment applied the migrations", () => {
    const it = remoteTest.extend("refusal", ({ remoteD1 }) =>
      remoteD1.runPromise(
        Effect.gen(function* bootstrapTooEarly() {
          yield* migrateD1(yield* TestBinding);
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          return yield* Effect.flip(
            runRemoteDatabaseCommand(["bootstrap", ...execute], {
              ...d1Target,
              email: "private@example.test",
            }),
          );
        }),
      ),
    );

    it(
      "refuses until the deployment has recorded every migration",
      { timeout: 60_000 },
      ({ refusal }) => {
        expect(refusal).toStrictEqual(new RemoteFailure({ code: "REMOTE_MIGRATIONS_REQUIRED" }));
      },
    );
  });
});
