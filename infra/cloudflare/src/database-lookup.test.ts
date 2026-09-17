import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Scope } from "effect";
import type { SetupServer } from "msw/node";
import { lookupDatabaseId } from "./database-lookup.ts";
import { setupServer } from "msw/node";

const HEX_ID_LENGTH = 32;
const FORBIDDEN_STATUS = 403;

const target = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  apiToken: "test-private-token-at-least-20-characters",
  name: "template-db",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database`;
const databaseId = "92b705e4-7b3b-42a9-9de3-700a33fa609c";

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

it.effect("resolves the database the stack owns by its declared name", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      http.get(endpoint, ({ request }) => {
        assert.strictEqual(new URL(request.url).searchParams.get("name"), target.name);
        assert.strictEqual(request.headers.get("authorization"), `Bearer ${target.apiToken}`);
        return HttpResponse.json({
          result: [
            { name: `${target.name}-preview`, uuid: "00000000-0000-0000-0000-000000000000" },
            { name: target.name, uuid: databaseId },
          ],
          success: true,
        });
      }),
    );
    assert.strictEqual(yield* lookupDatabaseId(target), databaseId);
  }).pipe(Effect.scoped),
);

it.effect("refuses to guess when the account exposes no matching database", () =>
  Effect.gen(function* program() {
    yield* mockServer(http.get(endpoint, () => HttpResponse.json({ result: [], success: true })));
    const failure = yield* lookupDatabaseId(target).pipe(Effect.flip);
    assert.strictEqual(failure.code, "database_output_unavailable");
  }).pipe(Effect.scoped),
);

it.effect("reports a refused token instead of continuing", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(endpoint, () => HttpResponse.json({ success: false }, { status: FORBIDDEN_STATUS })),
    );
    const failure = yield* lookupDatabaseId(target).pipe(Effect.flip);
    assert.strictEqual(failure.code, "database_output_unavailable");
  }).pipe(Effect.scoped),
);
