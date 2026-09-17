import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Scope } from "effect";
import { fetchUsage } from "./billing.ts";
import { setupNetwork } from "@msw/cloudflare";

type Network = ReturnType<typeof setupNetwork>;

const ACCOUNT_ID_LENGTH = 32;
const BILLED_COST_USD = 2;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/billable-usage`;

function withServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

it.effect("fetches the official V1 endpoint using bearer authentication", () =>
  Effect.gen(function* program() {
    yield* withServer(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      http.get(endpoint, ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer test-token") {
          // oxlint-disable-next-line unicorn/no-null
          return new HttpResponse(null, { status: 401 });
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
    const usage = yield* fetchUsage(account, "test-token", new Date("2026-09-16T00:00:00Z"));
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
    const failure = yield* fetchUsage(account, "test-token", new Date()).pipe(Effect.flip);
    assert.strictEqual(failure.code, "billing_http_failed");
    assert.notInclude(JSON.stringify(failure), "must-not-be-logged");
  }).pipe(Effect.scoped),
);
