import { expect, test } from "vite-plus/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchUsage } from "./billing.ts";

const account = "a".repeat(32);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/billable-usage`;

test("fetches the official V1 endpoint using bearer authentication", async () => {
  const server = setupServer(
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
  server.listen({ onUnhandledRequest: "error" });
  try {
    const usage = await fetchUsage(account, "test-token", new Date("2026-09-16T00:00:00Z"));
    expect(usage.usageUsd).toBe(2);
  } finally {
    server.close();
  }
});

test("does not return zero usage or expose response bodies on authorization failure", async () => {
  const server = setupServer(
    http.get(endpoint, () => HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 })),
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
