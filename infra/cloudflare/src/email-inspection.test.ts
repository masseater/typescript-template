import {
  FORBIDDEN_STATUS,
  access,
  account,
  accountHandlers,
  config,
  emptyState,
  sending,
  sendingRecords,
  zone,
} from "./inspection-fixture.ts";
import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { blocked, inspectAccount } from "./account-inspection.ts";
import { Effect } from "effect";
import { mockServer } from "./account-fixture.ts";

it.effect("blocks a sending domain carrying any record Email Service manages", () =>
  Effect.forEach(sendingRecords, (record) =>
    Effect.gen(function* program() {
      yield* mockServer(...accountHandlers({ records: [record] }));
      const inspection = yield* inspectAccount(access, config, emptyState());
      assert.deepStrictEqual(blocked(inspection), ["emailSending"]);
    }).pipe(Effect.scoped),
  ),
);

it.effect("blocks a sender address that is not the deployment's own subdomain of the zone", () =>
  Effect.forEach(
    [
      { verdict: "zone_apex", zoneName: sending },
      { verdict: "nested_subdomain", zoneName: "com" },
      { verdict: "outside_zone", zoneName: "elsewhere.example" },
    ] as const,
    (asked) =>
      Effect.gen(function* program() {
        yield* mockServer(...accountHandlers({ zoneName: asked.zoneName }));
        const inspection = yield* inspectAccount(access, config, emptyState());
        assert.strictEqual(inspection.senderDomain, asked.verdict);
        assert.deepStrictEqual(blocked(inspection), ["senderDomain"]);
      }).pipe(Effect.scoped),
  ),
);

it.effect("blocks a sending domain another deployment has already onboarded", () =>
  Effect.forEach([[sending], ["*.example.com"]], (subdomains) =>
    Effect.gen(function* program() {
      yield* mockServer(...accountHandlers({ records: sendingRecords, subdomains }));
      const inspection = yield* inspectAccount(access, config, emptyState());
      assert.strictEqual(inspection.sendingSubdomain, "taken");
      assert.deepStrictEqual(blocked(inspection).toSorted(), ["emailSending", "sendingSubdomain"]);
    }).pipe(Effect.scoped),
  ),
);

it.effect("ignores sending domains onboarded beside this deployment's own", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({ subdomains: ["other.example.com", "*.other.example.com"] }),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.strictEqual(inspection.sendingSubdomain, "free");
    assert.deepStrictEqual(blocked(inspection), []);
  }).pipe(Effect.scoped),
);

it.effect("blocks when the zone's sending domains cannot be read as the plan would", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${zone}/email/sending/subdomains`, () =>
        HttpResponse.json({ success: false }, { status: FORBIDDEN_STATUS }),
      ),
      ...accountHandlers({}),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.strictEqual(inspection.sendingSubdomain, "unreadable");
    assert.deepStrictEqual(blocked(inspection), ["sendingSubdomain"]);
  }).pipe(Effect.scoped),
);

it.effect("keeps reading the account when the destination addresses cannot be read", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(`${account}/email/routing/addresses`, () =>
        HttpResponse.json({ success: false }, { status: FORBIDDEN_STATUS }),
      ),
      ...accountHandlers({}),
    );
    const inspection = yield* inspectAccount(access, config, emptyState());
    assert.strictEqual(inspection.alertQuota, "unreadable");
    assert.deepStrictEqual(blocked(inspection), []);
  }).pipe(Effect.scoped),
);
