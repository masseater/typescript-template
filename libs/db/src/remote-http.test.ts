import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { query } from "./index.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { remoteExecutor } from "./remote-http.ts";
import { user } from "./schema.ts";
import { EmptyTestDatabase, TestBinding } from "./testing.ts";

const target = {
  accountId: "a".repeat(32),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
  apiToken: "test-private-token-at-least-20-characters",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
const Batch = Schema.Struct({
  batch: Schema.Array(
    Schema.Struct({
      sql: Schema.String,
      params: Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Null])),
    }),
  ),
});

const mockServer = (...handlers: Parameters<typeof setupServer>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) => Effect.sync(() => server.close()),
  );

it.effect("plan never accesses the network or discloses credentials and bootstrap identity", () =>
  Effect.gen(function* () {
    yield* mockServer();
    const output = yield* runRemoteDatabaseCommand(["bootstrap", "--plan"], {
      ...target,
      email: "private@example.test",
    });
    assert.strictEqual(output.ok, true);
    assert.strictEqual("remoteStateVerified" in output && output.remoteStateVerified, false);
    assert.notInclude(JSON.stringify(output), target.apiToken);
    assert.notInclude(JSON.stringify(output), "private@example.test");
  }).pipe(Effect.scoped),
);

it.effect("remote command uses the official HTTP batch contract with real D1 execution", () =>
  Effect.gen(function* () {
    const binding = yield* TestBinding;
    yield* mockServer(
      http.post(endpoint, async ({ request }) => {
        if (request.headers.get("authorization") !== `Bearer ${target.apiToken}`)
          return new HttpResponse(null, { status: 401 });
        const body = Schema.decodeUnknownSync(Batch)(await request.json());
        const result = await binding.batch(
          body.batch.map((statement) => binding.prepare(statement.sql).bind(...statement.params)),
        );
        return HttpResponse.json({ success: true, result });
      }),
    );
    const execute = ["--execute", "--confirm-database", target.databaseId];
    const migrated = yield* runRemoteDatabaseCommand(["migrate", ...execute], target);
    assert.strictEqual(migrated.event, "database.remote_migrated");
    const again = yield* runRemoteDatabaseCommand(["migrate", ...execute], target);
    assert.strictEqual("applied" in again && again.applied, 0);
    yield* query((database) =>
      database.insert(user).values({
        id: "first",
        name: "Private Name",
        email: "private@example.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const output = yield* runRemoteDatabaseCommand(["bootstrap", ...execute], {
      ...target,
      email: "private@example.test",
    });
    assert.deepStrictEqual(output, {
      ok: true,
      event: "database.remote_admin_bootstrapped",
      databaseId: target.databaseId,
    });
    const [first] = yield* query((database) => database.select().from(user));
    assert.strictEqual(first?.role, "admin");
    assert.strictEqual(first?.securityVersion, 1);
  }).pipe(Effect.scoped, Effect.provide(EmptyTestDatabase)),
);

for (const mode of ["http", "partial", "invalid", "redirect"] as const)
  it.effect(`sanitizes ${mode} failure without returning provider bodies or secrets`, () =>
    Effect.gen(function* () {
      yield* mockServer(
        http.post(endpoint, () => {
          if (mode === "redirect")
            return HttpResponse.redirect("https://untrusted.example.test/", 302);
          if (mode === "http")
            return HttpResponse.json({ error: target.apiToken }, { status: 403 });
          if (mode === "partial")
            return HttpResponse.json({
              success: true,
              result: [{ success: false, error: target.apiToken, results: [] }],
            });
          return HttpResponse.text(target.apiToken);
        }),
      );
      const executor = yield* remoteExecutor(target);
      const failure = yield* executor.batch([{ sql: "SELECT 1", params: [] }]).pipe(Effect.flip);
      assert.deepStrictEqual(failure.code, "REMOTE_QUERY_FAILED");
      assert.notInclude(JSON.stringify(failure), target.apiToken);
    }).pipe(Effect.scoped),
  );
