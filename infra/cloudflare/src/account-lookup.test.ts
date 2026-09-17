import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import {
  attachedHostnames,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import { deployTokenPermissions, missingPermissions } from "./deploy-token.ts";
import { Effect } from "effect";
import type { Scope } from "effect";
import type { SetupServer } from "msw/node";
import { setupServer } from "msw/node";
import { verificationSettings } from "./verification-fixture.ts";

const access = {
  accountId: verificationSettings.accountId,
  apiToken: "lookup-test-not-a-real-token",
};
const account = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}`;
const NOT_FOUND_STATUS = 404;
const tokenId = "0123456789abcdef0123456789abcdef";

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

const grantedGroups = deployTokenPermissions.map((required) => required.groups[0]);

it.effect("reads an untouched account as free of the names this deployment claims", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/workers/scripts/alchemy-state-store`, () =>
        HttpResponse.json({ success: false }, { status: NOT_FOUND_STATUS }),
      ),
      http.get(`${account}/secrets_store/stores`, () => HttpResponse.json({ result: [] })),
      http.get(`${account}/workers/scripts`, () => HttpResponse.json({ result: [] })),
      http.get(`${account}/workers/domains`, () => HttpResponse.json({ result: [] })),
      http.get(`${account}/workers/subdomain`, () =>
        HttpResponse.json({ result: { subdomain: "example-subdomain" } }),
      ),
    );
    assert.isFalse(yield* stateStorePresent(access));
    assert.strictEqual(yield* secretsStoreCount(access), 0);
    assert.deepStrictEqual(yield* workerNames(access), []);
    assert.deepStrictEqual(yield* attachedHostnames(access), []);
    assert.strictEqual(yield* workersSubdomain(access), "example-subdomain");
  }).pipe(Effect.scoped),
);

it.effect("reports an account another project already bootstrapped", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/workers/scripts/alchemy-state-store`, () =>
        HttpResponse.json({ result: { id: "alchemy-state-store" } }),
      ),
      http.get(`${account}/secrets_store/stores`, () =>
        HttpResponse.json({ result: [{ id: "store" }] }),
      ),
    );
    assert.isTrue(yield* stateStorePresent(access));
    assert.strictEqual(yield* secretsStoreCount(access), 1);
  }).pipe(Effect.scoped),
);

it.effect("names the deploy token permissions the account token does not carry", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/tokens/verify`, () => HttpResponse.json({ result: { id: tokenId } })),
      http.get(`${account}/tokens/${tokenId}`, () =>
        HttpResponse.json({
          result: {
            policies: [
              {
                permission_groups: grantedGroups
                  .filter((group) => group !== "Workers Routes Write")
                  .map((name) => ({ name })),
              },
            ],
          },
        }),
      ),
    );
    const granted = yield* grantedPermissions(access);
    assert.isDefined(granted);
    assert.deepStrictEqual(missingPermissions(granted), ["Zone / Workers Routes / Edit"]);
    assert.deepStrictEqual(missingPermissions([...grantedGroups]), []);
  }).pipe(Effect.scoped),
);
