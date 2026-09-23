import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Clock, DateTime, Effect, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { fetchUsage } from "./billing.ts";

import type { Scope } from "effect";

type Network = ReturnType<typeof setupNetwork>;

const ACCOUNT_ID_LENGTH = 32;
const BILLED_COST_USD = 2;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/billable-usage`;
const measuredAt = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-16T00:00:00Z"));

function withServer(
  ...handlers: Parameters<Network["use"]>
): Effect.Effect<Network, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(...handlers);
      network.enable();
      return network;
    }),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

it.effect("fetches the official V1 endpoint using bearer authentication", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.get(endpoint, ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer test-token") {
          return new HttpResponse(undefined, { status: 401 });
        }
        return HttpResponse.json({
          result: [
            {
              BilledCost: BILLED_COST_USD,
              BillingAccountId: account,
              BillingCurrency: "USD",
              BillingPeriodStart: "2026-09-01T00:00:00Z",
              ChargeCategory: "Usage",
              ChargePeriodEnd: "2026-09-15T00:00:00Z",
              ChargePeriodStart: "2026-09-14T00:00:00Z",
              ServiceName: "Workers",
            },
          ],
          success: true,
        });
      }),
    );
    const usage = yield* fetchUsage(account, "test-token", measuredAt);
    assert.strictEqual(usage.usageUsd, BILLED_COST_USD);
  }).pipe(Effect.scoped),
);

it.effect("does not return zero usage or expose response bodies on authorization failure", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.get(endpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 }),
      ),
    );
    const failure = yield* fetchUsage(account, "test-token", yield* Clock.currentTimeMillis).pipe(
      Effect.flip,
    );
    assert.strictEqual(failure.code, "billing_http_failed");
    assert.notInclude(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(failure),
      "must-not-be-logged",
    );
  }).pipe(Effect.scoped),
);
