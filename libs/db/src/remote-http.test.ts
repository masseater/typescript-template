import type { D1Database } from "@cloudflare/workers-types";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Scope } from "effect";
import { HttpResponse, http } from "msw";
import type { SetupServer } from "msw/node";
import { setupServer } from "msw/node";

import type { Database } from "./database.ts";
import { query } from "./database.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { remoteExecutor } from "./remote-http.ts";
import { user } from "./schema.ts";
import { EmptyTestDatabase, TestBinding, executeD1HttpBatch } from "./testing-node.ts";

const HEX_ID_LENGTH = 32;
const REDIRECT_STATUS = 302;
const FORBIDDEN_STATUS = 403;
const UNAUTHORIZED_STATUS = 401;

const target = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
const execute = ["--execute", "--confirm-database", target.databaseId];

function mockServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
}

function d1Endpoint(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  binding: D1Database,
): Effect.Effect<SetupServer, never, Scope.Scope> {
  return mockServer(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    http.post(endpoint, async ({ request }) => {
      if (request.headers.get("authorization") !== `Bearer ${target.apiToken}`) {
        return HttpResponse.json({ error: "unauthorized" }, { status: UNAUTHORIZED_STATUS });
      }
      return HttpResponse.json(await executeD1HttpBatch(binding, await request.json()));
    }),
  );
}

function insertVerifiedUser(): Effect.Effect<void, unknown, Database> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: "private@example.test",
      emailVerified: true,
      id: "first",
      name: "Private Name",
      updatedAt: new Date(),
    });
  });
}

function failureResponse(mode: "http" | "partial" | "invalid" | "redirect"): Response {
  if (mode === "redirect") {
    return HttpResponse.redirect("https://untrusted.example.test/", REDIRECT_STATUS);
  }
  if (mode === "http") {
    return HttpResponse.json({ error: target.apiToken }, { status: FORBIDDEN_STATUS });
  }
  if (mode === "partial") {
    return HttpResponse.json({
      result: [{ error: target.apiToken, results: [], success: false }],
      success: true,
    });
  }
  return HttpResponse.text(target.apiToken);
}

it.effect("plan never accesses the network or discloses credentials and bootstrap identity", () =>
  Effect.gen(function* program() {
    yield* mockServer();
    const output = yield* runRemoteDatabaseCommand(["bootstrap", "--plan"], {
      ...target,
      email: "private@example.test",
    });
    assert.isTrue(output.ok);
    assert.isFalse("remoteStateVerified" in output && output.remoteStateVerified);
    assert.notInclude(JSON.stringify(output), target.apiToken);
    assert.notInclude(JSON.stringify(output), "private@example.test");
    assert.notInclude(JSON.stringify(output), target.accountId);
    assert.include(JSON.stringify(output), target.databaseId);
  }).pipe(Effect.scoped),
);

it.effect("remote migrations use the official HTTP batch contract with real D1 execution", () =>
  Effect.gen(function* program() {
    yield* d1Endpoint(yield* TestBinding);
    const migrated = yield* runRemoteDatabaseCommand(["migrate", ...execute], target);
    assert.strictEqual(migrated.event, "database.remote_migrated");
    const again = yield* runRemoteDatabaseCommand(["migrate", ...execute], target);
    assert.strictEqual("applied" in again && again.applied, 0);
  }).pipe(Effect.scoped, Effect.provide(EmptyTestDatabase)),
);

it.effect("remote bootstrap promotes the verified user through the HTTP batch contract", () =>
  Effect.gen(function* program() {
    yield* d1Endpoint(yield* TestBinding);
    yield* runRemoteDatabaseCommand(["migrate", ...execute], target);
    yield* insertVerifiedUser();
    const output = yield* runRemoteDatabaseCommand(["bootstrap", ...execute], {
      ...target,
      email: "private@example.test",
    });
    assert.deepStrictEqual(output, {
      databaseId: target.databaseId,
      event: "database.remote_admin_bootstrapped",
      ok: true,
    });
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    const [first] = yield* query(async (database) => database.select().from(user));
    assert.strictEqual(first?.role, "admin");
    assert.strictEqual(first?.securityVersion, 1);
  }).pipe(Effect.scoped, Effect.provide(EmptyTestDatabase)),
);

for (const mode of ["http", "partial", "invalid", "redirect"] as const) {
  it.effect(`sanitizes ${mode} failure without returning provider bodies or secrets`, () =>
    Effect.gen(function* program() {
      yield* mockServer(http.post(endpoint, () => failureResponse(mode)));
      const executor = remoteExecutor(target);
      const failure = yield* executor.batch([{ params: [], sql: "SELECT 1" }]).pipe(Effect.flip);
      assert.deepStrictEqual(failure.code, "REMOTE_QUERY_FAILED");
      assert.notInclude(JSON.stringify(failure), target.apiToken);
    }).pipe(Effect.scoped),
  );
}
