import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import {
  attachedService,
  grantedPermissions,
  secretsStoreCount,
  stateStorePresent,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import { deployTokenPermissions, missingPermissions } from "./deploy-token.ts";
import { Effect } from "effect";
import { mockServer } from "./account-fixture.ts";
import { verificationSettings } from "./verification-fixture.ts";

const access = {
  accountId: verificationSettings.accountId,
  apiToken: "lookup-test-not-a-real-token",
};
const account = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}`;
const NOT_FOUND_STATUS = 404;
const tokenId = "0123456789abcdef0123456789abcdef";
const granted = deployTokenPermissions.map((required) => ({ name: required.satisfiedBy[0].name }));
const withoutRoutes = granted.filter(
  (group: { readonly name: string }) => group.name !== "Workers Routes Write",
);

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
    assert.isUndefined(yield* attachedService(access, "user.example.com"));
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

it.effect("refuses a collection it cannot reach instead of reading it as empty", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/secrets_store/stores`, () =>
        HttpResponse.json({ success: false }, { status: NOT_FOUND_STATUS }),
      ),
    );
    const failure = yield* secretsStoreCount(access).pipe(Effect.flip);
    assert.strictEqual(failure.code, "account_read_unavailable");
  }).pipe(Effect.scoped),
);

it.effect("refuses a page that does not carry every row Cloudflare counted", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/workers/scripts`, () =>
        HttpResponse.json({ result: [{ id: "one" }], result_info: { total_count: 2 } }),
      ),
    );
    const failure = yield* workerNames(access).pipe(Effect.flip);
    assert.strictEqual(failure.code, "account_read_unavailable");
  }).pipe(Effect.scoped),
);

it.effect("asks for the worker a single hostname is attached to", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      http.get(`${account}/workers/domains`, ({ request }) => {
        assert.strictEqual(new URL(request.url).searchParams.get("hostname"), "user.example.com");
        return HttpResponse.json({
          result: [{ hostname: "user.example.com", service: "other-user" }],
        });
      }),
    );
    assert.strictEqual(yield* attachedService(access, "user.example.com"), "other-user");
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
                permission_groups: withoutRoutes,
              },
            ],
          },
        }),
      ),
    );
    assert.deepStrictEqual(missingPermissions(yield* grantedPermissions(access)), [
      "Zone / Workers Routes / Edit",
    ]);
    assert.deepStrictEqual(missingPermissions(granted), []);
    assert.deepStrictEqual(
      missingPermissions(
        deployTokenPermissions.map((required) => ({ id: required.satisfiedBy[0].id })),
      ),
      [],
    );
    assert.deepStrictEqual(
      missingPermissions([
        { name: "Workers Scripts Write" },
        { name: "D1 Write" },
        { name: "Secrets Store Write" },
        { name: "Account API Tokens Write" },
        { name: "Billing Write" },
        { name: "Workers Observability Write" },
        { name: "Workers Routes Write" },
        { name: "DNS Write" },
      ]),
      [],
      "a token holding only the write groups already satisfies the read requirements",
    );
  }).pipe(Effect.scoped),
);

it.effect("treats a token the account does not own as unreadable, not as unrestricted", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/tokens/verify`, () =>
        HttpResponse.json({ success: false }, { status: NOT_FOUND_STATUS }),
      ),
    );
    const failure = yield* grantedPermissions(access).pipe(Effect.flip);
    assert.strictEqual(failure.code, "account_read_unavailable");
  }).pipe(Effect.scoped),
);
