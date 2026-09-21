import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { billableUsageEndpoint, fetchUsage } from "./billing.ts";
import { BudgetFailure } from "./config.ts";

const ACCOUNT_ID_LENGTH = 32;
const BILLED_COST_USD = 2;
const accountId = "a".repeat(ACCOUNT_ID_LENGTH);
const usageEndpoint = billableUsageEndpoint(accountId);

const usageEnvelope = {
  result: [
    {
      BilledCost: BILLED_COST_USD,
      BillingAccountId: accountId,
      BillingCurrency: "USD",
      BillingPeriodStart: "2026-09-01T00:00:00Z",
      ChargeCategory: "Usage",
      ChargePeriodEnd: "2026-09-15T00:00:00Z",
      ChargePeriodStart: "2026-09-14T00:00:00Z",
      ServiceName: "Workers",
    },
  ],
  success: true,
} as const;

describe("fetchUsage", () => {
  const it = test.extend("observedUsage", async ({}, { onCleanup }) => {
    const billingApi = setupServer(
      http.get(usageEndpoint, ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer test-token") {
          return new HttpResponse(undefined, { status: 401 });
        }
        return HttpResponse.json(usageEnvelope);
      }),
    );
    billingApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      billingApi.close();
    });
    return Effect.runPromise(
      fetchUsage({
        accountId,
        observedAt: new Date("2026-09-16T00:00:00Z"),
        token: "test-token",
        usageEndpoint,
      }),
    );
  });

  it("aggregates billed cost from the official usage endpoint", ({ observedUsage }) => {
    expect(observedUsage).toStrictEqual({
      measuredThrough: "2026-09-15T00:00:00.000Z",
      periodStart: "2026-09-01T00:00:00Z",
      records: 1,
      usageUsd: BILLED_COST_USD,
    });
  });
});

describe("fetchUsage authorization failure", () => {
  const it = test.extend("billingFailure", async ({}, { onCleanup }) => {
    const billingApi = setupServer(
      http.get(usageEndpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 }),
      ),
    );
    billingApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      billingApi.close();
    });
    return Effect.runPromise(
      Effect.flip(
        fetchUsage({
          accountId,
          observedAt: new Date(),
          token: "test-token",
          usageEndpoint,
        }),
      ),
    );
  });

  it("fails closed on authorization failure", ({ billingFailure }) => {
    expect(billingFailure).toStrictEqual(new BudgetFailure({ code: "billing_http_failed" }));
  });
});
