import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { mockServer, pagedCollection, unpagedCollection } from "./account-fixture.ts";
import {
  attachedService,
  dnsRecordNames,
  grantedPermissions,
  secretsStoreCount,
  workerNames,
  workersSubdomain,
} from "./account-lookup.ts";
import {
  STATE_STORE_SCRIPT_NAME,
  deployTokenPermissions,
  missingPermissions,
} from "./deploy-token.ts";
import { describeFailure } from "./secrets.ts";
import { verificationSettings } from "./verification-fixture.ts";

const access = {
  accountId: verificationSettings.accountId,
  apiToken: "lookup-test-not-a-real-token",
};
const account = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}`;
const zone = `https://api.cloudflare.com/client/v4/zones/${verificationSettings.zoneId}`;
const { hostname } = new URL(verificationSettings.origins["service-member"]);
const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const SECRETS_STORE_PAGE_LIMIT = 100;
const tokenId = "a".repeat(32);
const granted = deployTokenPermissions.map((required) => ({ name: required.satisfiedBy[0].name }));
const withoutRoutes = granted.filter(
  (group: { readonly name: string }) => group.name !== "Workers Routes Write",
);

it.effect("reads an untouched account as free of the names this deployment claims", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      pagedCollection(`${account}/secrets_store/stores`, SECRETS_STORE_PAGE_LIMIT, () =>
        HttpResponse.json({
          result: [],
          result_info: { count: 0, page: 1, per_page: 20, total_count: 0 },
        }),
      ),
      unpagedCollection(`${account}/workers/scripts`, () =>
        // oxlint-disable-next-line unicorn/no-null
        HttpResponse.json({ result: [], result_info: null }),
      ),
      unpagedCollection(`${account}/workers/domains`, () =>
        HttpResponse.json({
          result: [],
          result_info: { count: 0, page: 1, per_page: 0, total_count: 0 },
        }),
      ),
      unpagedCollection(`${zone}/dns_records`, ({ request }) => {
        assert.strictEqual(new URL(request.url).searchParams.get("name.exact"), hostname);
        return HttpResponse.json({ result: [], result_info: { per_page: 100, total_count: 0 } });
      }),
      http.get(`${account}/workers/subdomain`, () =>
        HttpResponse.json({ result: { subdomain: "example-subdomain" } }),
      ),
    );
    assert.strictEqual(yield* secretsStoreCount(access), 0);
    assert.deepStrictEqual(yield* workerNames(access), []);
    assert.isUndefined(yield* attachedService(access, hostname));
    assert.deepStrictEqual(
      yield* dnsRecordNames(access, verificationSettings.zoneId, hostname),
      [],
    );
    assert.strictEqual(yield* workersSubdomain(access), "example-subdomain");
  }).pipe(Effect.scoped),
);

it.effect("keeps a read honest when the collection ignores the filter it was given", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${zone}/dns_records`, () =>
        HttpResponse.json({
          result: [{ name: "mail.example.com" }, { name: "other.example.com" }],
          result_info: { count: 2, page: 1, per_page: 100, total_count: 2, total_pages: 1 },
        }),
      ),
      http.get(`${account}/workers/domains`, () =>
        HttpResponse.json({
          result: [{ hostname: "other.example.com", service: "someone-elses-worker" }],
          result_info: { count: 1, page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      ),
    );
    assert.deepStrictEqual(
      yield* dnsRecordNames(access, verificationSettings.zoneId, hostname),
      [],
    );
    assert.isUndefined(yield* attachedService(access, hostname));
  }).pipe(Effect.scoped),
);

it.effect("names the read that failed and why, without naming the zone or the hostname", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${zone}/dns_records`, () =>
        HttpResponse.json({ success: false }, { status: FORBIDDEN_STATUS }),
      ),
    );
    const failure = yield* dnsRecordNames(access, verificationSettings.zoneId, hostname).pipe(
      Effect.flip,
    );
    assert.deepStrictEqual(failure.keys, ["zones/{}/dns_records", `status_${FORBIDDEN_STATUS}`]);
    const printed = JSON.stringify(describeFailure(failure, []));
    for (const value of [access.accountId, verificationSettings.zoneId, hostname]) {
      assert.notInclude(printed, value);
    }
  }).pipe(Effect.scoped),
);

it.effect("refuses rows that do not carry the fields the read declares", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/secrets_store/stores`, () =>
        HttpResponse.json({ result: [{}], result_info: { per_page: 100, total_count: 1 } }),
      ),
    );
    const failure = yield* secretsStoreCount(access).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, [
      "accounts/{}/secrets_store/stores",
      "decode_failed",
      "result.0.id:MissingKey",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("names the media type when a read is answered with something other than JSON", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(
        `${account}/workers/scripts`,
        () =>
          new HttpResponse("--boundary\r\ncontent-disposition: form-data\r\n", {
            headers: { "content-type": "multipart/form-data; boundary=boundary" },
          }),
      ),
    );
    const failure = yield* workerNames(access).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, [
      "accounts/{}/workers/scripts",
      "decode_failed",
      "multipart/form-data",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("reports an account another project already bootstrapped", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      unpagedCollection(`${account}/workers/scripts`, () =>
        // oxlint-disable-next-line unicorn/no-null
        HttpResponse.json({ result: [{ id: STATE_STORE_SCRIPT_NAME }], result_info: null }),
      ),
      pagedCollection(`${account}/secrets_store/stores`, SECRETS_STORE_PAGE_LIMIT, () =>
        HttpResponse.json({
          result: [{ id: "store" }],
          result_info: { per_page: 100, total_count: 1 },
        }),
      ),
    );
    assert.deepStrictEqual(yield* workerNames(access), [STATE_STORE_SCRIPT_NAME]);
    assert.strictEqual(yield* secretsStoreCount(access), 1);
  }).pipe(Effect.scoped),
);

it.effect("refuses a collection it cannot reach instead of reading it as empty", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/secrets_store/stores`, () =>
        HttpResponse.json({ result: [], success: true }, { status: NOT_FOUND_STATUS }),
      ),
    );
    const failure = yield* secretsStoreCount(access).pipe(Effect.flip);
    assert.strictEqual(failure.code, "account_read_unavailable");
    assert.deepStrictEqual(failure.keys, [
      "accounts/{}/secrets_store/stores",
      `status_${NOT_FOUND_STATUS}`,
    ]);
  }).pipe(Effect.scoped),
);

it.effect("refuses a collection the token is not allowed to see", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/workers/scripts`, () =>
        HttpResponse.json({ result: [], success: false }, { status: FORBIDDEN_STATUS }),
      ),
    );
    const failure = yield* workerNames(access).pipe(Effect.flip);
    assert.strictEqual(failure.code, "account_read_unavailable");
    assert.deepStrictEqual(failure.keys, [
      "accounts/{}/workers/scripts",
      `status_${FORBIDDEN_STATUS}`,
    ]);
  }).pipe(Effect.scoped),
);

it.effect("requires every permission the deployment actually exercises", () =>
  Effect.sync(() => {
    const required = deployTokenPermissions.map((permission) => permission.dashboard);
    assert.includeMembers(required, [
      "Account / Workers Scripts / Edit",
      "Account / D1 / Edit",
      "Account / Secrets Store / Edit",
      "Account / API Tokens / Edit",
      "Account / API Tokens / Read",
      "Account / Billing / Read",
      "Account / Workers Observability / Write",
      "Account / Email Sending / Write",
      "Account / Email Routing Addresses / Read",
      "Zone / Workers Routes / Edit",
      "Zone / DNS / Read",
      "Zone / Zone Settings / Edit",
    ]);
    assert.deepStrictEqual(missingPermissions([{ name: "DNS Read" }]).toSorted(), [
      "Account / API Tokens / Edit",
      "Account / API Tokens / Read",
      "Account / Billing / Read",
      "Account / D1 / Edit",
      "Account / Email Routing Addresses / Read",
      "Account / Email Sending / Write",
      "Account / Secrets Store / Edit",
      "Account / Workers Observability / Write",
      "Account / Workers Scripts / Edit",
      "Zone / Workers Routes / Edit",
      "Zone / Zone Settings / Edit",
    ]);
  }),
);

it.effect("asks for the worker a single hostname is attached to", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/workers/domains`, ({ request }) => {
        assert.strictEqual(new URL(request.url).searchParams.get("hostname"), hostname);
        return HttpResponse.json({ result: [{ hostname, service: "other-user" }] });
      }),
    );
    assert.strictEqual(yield* attachedService(access, hostname), "other-user");
  }).pipe(Effect.scoped),
);

it.effect("names the deploy token permissions the account token does not carry", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/tokens/verify`, () => HttpResponse.json({ result: { id: tokenId } })),
      http.get(`${account}/tokens/${tokenId}`, () =>
        HttpResponse.json({
          result: { policies: [{ permission_groups: withoutRoutes }] },
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
        { name: "Email Sending Write" },
        { name: "Email Routing Addresses Write" },
        { name: "Zone Settings Write" },
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
    assert.deepStrictEqual(failure.keys, [
      "accounts/{}/tokens/verify",
      `status_${NOT_FOUND_STATUS}`,
    ]);
  }).pipe(Effect.scoped),
);
