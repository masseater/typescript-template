import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { query } from "./database.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { loadRemoteMigrations } from "./remote-operations.ts";
import { user } from "./schema.ts";
import { EmptyTestDatabase, TestBinding, executeD1HttpBatch } from "./testing-node.ts";

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};

const d1Query = `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/query`;

describe("runRemoteDatabaseCommand", () => {
  describe("a bootstrap plan", () => {
    const it = test
      .extend("migrationList", async () =>
        Effect.runPromise(
          Effect.map(loadRemoteMigrations(), (migrations) =>
            migrations.map((migration) => ({ hash: migration.hash, name: migration.name })),
          ),
        ))
      .extend("planReport", async ({}, { onCleanup }) => {
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

  describe("a migration executed twice through the D1 HTTP batch contract", () => {
    const it = test.extend("secondReport", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* migrateTwice() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1Query, async ({ request }) =>
              request.headers.get("authorization") === `Bearer ${d1Target.apiToken}`
                ? HttpResponse.json(await executeD1HttpBatch(binding, await request.json()))
                : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
          return yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

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
    const it = test.extend("promotedUsers", async ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* bootstrapRemote() {
          const binding = yield* TestBinding;
          const d1Api = setupServer(
            http.post(d1Query, async ({ request }) =>
              request.headers.get("authorization") === `Bearer ${d1Target.apiToken}`
                ? HttpResponse.json(await executeD1HttpBatch(binding, await request.json()))
                : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
            ),
          );
          d1Api.listen({ onUnhandledRequest: "error" });
          onCleanup(() => {
            d1Api.close();
          });
          const execute = ["--execute", "--confirm-database", d1Target.databaseId];
          yield* runRemoteDatabaseCommand(["migrate", ...execute], d1Target);
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: new Date(),
              email: "private@example.test",
              emailVerified: true,
              id: "first",
              name: "Private Name",
              updatedAt: new Date(),
            });
          });
          yield* runRemoteDatabaseCommand(["bootstrap", ...execute], {
            ...d1Target,
            email: "private@example.test",
          });
          return yield* query(async (database) =>
            database.select({ role: user.role, securityVersion: user.securityVersion }).from(user),
          );
        }).pipe(Effect.provide(EmptyTestDatabase)),
      ));

    it(
      "promotes the verified user and bumps their security version",
      { timeout: 60_000 },
      ({ promotedUsers }) => {
        expect(promotedUsers).toStrictEqual([{ role: "admin", securityVersion: 1 }]);
      },
    );
  });
});
