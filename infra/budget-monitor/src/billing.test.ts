import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vite-plus/test";
import { fetchUsage } from "./billing.ts";
import { setupServer } from "msw/node";

const ACCOUNT_ID_LENGTH = 32;
const BILLED_COST_USD = 2;
const FORBIDDEN_STATUS = 403;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const usageRow = {
  BilledCost: BILLED_COST_USD,
  BillingAccountId: account,
  BillingCurrency: "USD",
  BillingPeriodStart: "2026-09-01T00:00:00Z",
  ChargeCategory: "Usage",
  ChargePeriodEnd: "2026-09-15T00:00:00Z",
  ChargePeriodStart: "2026-09-14T00:00:00Z",
  ServiceName: "Workers",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/billable-usage`;

describe("billable usage client", () => {
  it("fetches the official V1 endpoint using bearer authentication", async () => {
    expect.hasAssertions();
    const authorizations: unknown[] = [];
    const server = setupServer(
      http.get(endpoint, ({ request }) => {
        authorizations.push(request.headers.get("authorization"));
        return HttpResponse.json({ result: [usageRow], success: true });
      }),
    );
    server.listen({ onUnhandledRequest: "error" });
    try {
      const usage = await fetchUsage(account, "test-token", new Date("2026-09-16T00:00:00Z"));
      expect(authorizations).toStrictEqual(["Bearer test-token"]);
      expect(usage.usageUsd).toBe(BILLED_COST_USD);
    } finally {
      server.close();
    }
  });

  it("does not return zero usage or expose response bodies on authorization failure", async () => {
    expect.hasAssertions();
    const server = setupServer(
      http.get(endpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: FORBIDDEN_STATUS }),
      ),
    );
    server.listen({ onUnhandledRequest: "error" });
    try {
      await expect(fetchUsage(account, "test-token", new Date())).rejects.toThrow(
        "billing_http_failed",
      );
    } finally {
      server.close();
    }
  });
});
