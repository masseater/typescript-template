import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchUsage } from "./billing.ts";

const account = "a".repeat(32);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/billable-usage`;

const withServer = (...handlers: Parameters<typeof setupServer>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) => Effect.sync(() => server.close()),
  );

it.effect("fetches the official V1 endpoint using bearer authentication", () =>
  Effect.gen(function* () {
    yield* withServer(
      http.get(endpoint, ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer test-token")
          return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({
          success: true,
          result: [
            {
              BillingAccountId: account,
              BillingCurrency: "USD",
              BillingPeriodStart: "2026-09-01T00:00:00Z",
              ChargePeriodStart: "2026-09-14T00:00:00Z",
              ChargePeriodEnd: "2026-09-15T00:00:00Z",
              ChargeCategory: "Usage",
              ServiceName: "Workers",
              BilledCost: 2,
            },
          ],
        });
      }),
    );
    const usage = yield* fetchUsage(account, "test-token", new Date("2026-09-16T00:00:00Z"));
    assert.strictEqual(usage.usageUsd, 2);
  }).pipe(Effect.scoped),
);

it.effect("does not return zero usage or expose response bodies on authorization failure", () =>
  Effect.gen(function* () {
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
