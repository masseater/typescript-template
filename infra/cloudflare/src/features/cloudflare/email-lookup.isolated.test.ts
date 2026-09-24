import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpResponse } from "msw";

import { mockServer, pagedCollection } from "./account-test-fixture.ts";
import { destinationAddresses } from "./email-lookup.ts";
import { verificationSettings } from "./verification-settings.ts";

const ADDRESS_PAGE_LIMIT = 50;
const access = {
  accountId: verificationSettings.accountId,
  apiToken: "email-lookup-test-not-a-real-token",
};
const addresses = `https://api.cloudflare.com/client/v4/accounts/${access.accountId}/email/routing/addresses`;
const mixedRows = `{"result":[{"email":"alerts@example.com","verified":"2026-01-01T00:00:00Z"},{"email":"pending@example.com","verified":null},{"email":null,"verified":null}],"result_info":{"per_page":50,"total_count":3}}`;

it.effect("marks as verified only the destination addresses Cloudflare has dated", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      pagedCollection(addresses, ADDRESS_PAGE_LIMIT, ({ request }) => {
        const asked = new URL(request.url).searchParams;
        assert.strictEqual(asked.get("per_page"), String(ADDRESS_PAGE_LIMIT));
        assert.strictEqual(asked.get("page"), "1");
        return new HttpResponse(mixedRows, { headers: { "content-type": "application/json" } });
      }),
    );
    assert.deepStrictEqual(yield* destinationAddresses(access), [
      { email: "alerts@example.com", verified: true },
      { email: "pending@example.com", verified: false },
    ]);
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
    assert.lengthOf(yield* destinationAddresses(access), rows.length);
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
    const failure = yield* destinationAddresses(access).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, ["accounts/{}/email/routing/addresses", "truncated"]);
  }).pipe(Effect.scoped),
);
