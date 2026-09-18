import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import { findDatabaseId, lookupDatabaseId } from "./database-lookup.ts";

import type { Scope } from "effect";
import type { SetupServer } from "msw/node";

const HEX_ID_LENGTH = 32;
const FORBIDDEN_STATUS = 403;

const access = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  apiToken: "test-private-token-at-least-20-characters",
};
const target = { ...access, name: "template-db" };
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database`;
const databaseId = "22222222-2222-4222-8222-222222222222";

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
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
}

it.effect("resolves the database the stack owns by its declared name", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, ({ request }) => {
        const query = new URL(request.url).searchParams;
        assert.strictEqual(query.get("name"), target.name);
        assert.isNull(query.get("per_page"));
        assert.strictEqual(request.headers.get("authorization"), `Bearer ${target.apiToken}`);
        return HttpResponse.json({
          result: [
            { name: `${target.name}-preview`, uuid: "00000000-0000-0000-0000-000000000000" },
            { name: target.name, uuid: databaseId },
          ],
          result_info: { count: 2, page: 1, per_page: 100, total_count: 5, total_pages: 1 },
          success: true,
        });
      }),
    );
    assert.strictEqual(yield* lookupDatabaseId(access, target.name), databaseId);
  }).pipe(Effect.scoped),
);

it.effect("reports an unused name so a first deploy is not silently adopted", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () =>
        HttpResponse.json({
          result: [],
          result_info: { count: 0, page: 1, per_page: 100, total_count: 5, total_pages: 1 },
          success: true,
        }),
      ),
    );
    assert.isUndefined(yield* findDatabaseId(access, target.name));
  }).pipe(Effect.scoped),
);

it.effect("reports a name already taken by an unrelated database", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () =>
        HttpResponse.json({
          result: [{ name: target.name, uuid: databaseId }],
          result_info: { count: 1, page: 1, per_page: 100, total_count: 5, total_pages: 1 },
          success: true,
        }),
      ),
    );
    assert.strictEqual(yield* findDatabaseId(access, target.name), databaseId);
  }).pipe(Effect.scoped),
);

it.effect("refuses to pick between two databases carrying the declared name", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () =>
        HttpResponse.json({
          result: [
            { name: target.name, uuid: databaseId },
            { name: target.name, uuid: "11111111-2222-3333-4444-555555555555" },
          ],
          result_info: { count: 2, page: 1, per_page: 100, total_count: 5, total_pages: 1 },
          success: true,
        }),
      ),
    );
    const failure = yield* findDatabaseId(access, target.name).pipe(Effect.flip);
    assert.strictEqual(failure.code, "database_output_unavailable");
    assert.deepStrictEqual(failure.keys, ["accounts/{}/d1/database", "ambiguous_name"]);
  }).pipe(Effect.scoped),
);

it.effect("refuses to guess when the account exposes no matching database", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () =>
        HttpResponse.json({
          result: [],
          result_info: { count: 0, page: 1, per_page: 100, total_count: 5, total_pages: 1 },
          success: true,
        }),
      ),
    );
    const failure = yield* lookupDatabaseId(access, target.name).pipe(Effect.flip);
    assert.strictEqual(failure.code, "database_output_unavailable");
    assert.deepStrictEqual(failure.keys, ["accounts/{}/d1/database", "absent"]);
  }).pipe(Effect.scoped),
);

it.effect("reports a refused token instead of continuing", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () => HttpResponse.json({ success: false }, { status: FORBIDDEN_STATUS })),
    );
    const failure = yield* lookupDatabaseId(access, target.name).pipe(Effect.flip);
    assert.strictEqual(failure.code, "database_output_unavailable");
    assert.deepStrictEqual(failure.keys, ["accounts/{}/d1/database", `status_${FORBIDDEN_STATUS}`]);
  }).pipe(Effect.scoped),
);
