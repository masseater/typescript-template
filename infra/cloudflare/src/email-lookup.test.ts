import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { mockServer, pagedCollection } from "./account-fixture.ts";
import { senderVerdict, verifiedAddresses } from "./email-lookup.ts";
import { Effect } from "effect";
import { verificationSettings } from "./verification-fixture.ts";

const ADDRESS_PAGE_LIMIT = 50;
const access = {
  accountId: verificationSettings.accountId,
  apiToken: "email-lookup-test-not-a-real-token",
};
const addresses = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}/email/routing/addresses`;
const zone = `https://api.cloudflare.com/client/v4/zones/${verificationSettings.zoneId}`;
const mixedRows = `{"result":[{"email":"alerts@example.com","verified":"2026-01-01T00:00:00Z"},{"email":"pending@example.com","verified":null},{"email":null,"verified":null}],"result_info":{"per_page":50,"total_count":3}}`;

it.effect("counts only the destination addresses Cloudflare has dated as verified", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      pagedCollection(addresses, ADDRESS_PAGE_LIMIT, ({ request }) => {
        const asked = new URL(request.url).searchParams;
        assert.strictEqual(asked.get("per_page"), String(ADDRESS_PAGE_LIMIT));
        assert.strictEqual(asked.get("page"), "1");
        return new HttpResponse(mixedRows, { headers: { "content-type": "application/json" } });
      }),
    );
    assert.deepStrictEqual(yield* verifiedAddresses(access), ["alerts@example.com"]);
  }).pipe(Effect.scoped),
);

it.effect("asks for every page Cloudflare counted rather than the first one", () =>
  Effect.gen(function* program() {
    const rows = Array.from({ length: ADDRESS_PAGE_LIMIT + 1 }, (_unused, index) => ({
      email: `alerts-${index}@example.com`,
      verified: "2026-01-01T00:00:00Z",
    }));
    yield* mockServer(
      pagedCollection(addresses, ADDRESS_PAGE_LIMIT, ({ request }) => {
        const asked = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          result: rows.slice((asked - 1) * ADDRESS_PAGE_LIMIT, asked * ADDRESS_PAGE_LIMIT),
          result_info: { per_page: ADDRESS_PAGE_LIMIT, total_count: rows.length },
        });
      }),
    );
    assert.lengthOf(yield* verifiedAddresses(access), rows.length);
  }).pipe(Effect.scoped),
);

it.effect("refuses an address list whose pages do not add up to what Cloudflare counted", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      pagedCollection(addresses, ADDRESS_PAGE_LIMIT, () =>
        HttpResponse.json({
          result: [],
          result_info: { per_page: ADDRESS_PAGE_LIMIT, total_count: 2 },
        }),
      ),
    );
    const failure = yield* verifiedAddresses(access).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, ["accounts/{}/email/routing/addresses", "truncated"]);
  }).pipe(Effect.scoped),
);

it.effect(
  "tells the deployment's own subdomain from the apex, a deeper name and another zone",
  () =>
    Effect.forEach(
      [
        { name: "example.com", verdict: "dedicated" },
        { name: `${verificationSettings.prefix}.example.com`, verdict: "zone_apex" },
        { name: "com", verdict: "nested_subdomain" },
        { name: "elsewhere.example", verdict: "outside_zone" },
      ] as const,
      (asked) =>
        Effect.gen(function* program() {
          yield* mockServer(
            http.get(zone, () => HttpResponse.json({ result: { name: asked.name } })),
          );
          assert.strictEqual(yield* senderVerdict(access, verificationSettings), asked.verdict);
        }).pipe(Effect.scoped),
    ),
);
