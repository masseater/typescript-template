import { expect, test } from "vite-plus/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { parseBudgetConfig } from "./config.ts";
import { fetchUsage } from "./billing.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

const account = "a".repeat(32);
const rawConfig = {
  CLOUDFLARE_ACCOUNT_ID: account,
  BILLING_READ_TOKEN: "test-read-only-token-not-a-secret",
  BUDGET_JPY: "5000",
  JPY_PER_USD: "100",
  FIXED_COST_USD: "5",
  RESERVE_USD: "5",
  ALERT_FROM: "mail@example.com",
  ALERT_TO: "owner@example.com",
};
const record = {
  BillingAccountId: account,
  BillingCurrency: "USD",
  BillingPeriodStart: "2026-09-01T00:00:00Z",
  ChargePeriodStart: "2026-09-14T00:00:00Z",
  ChargePeriodEnd: "2026-09-15T00:00:00Z",
  ChargeCategory: "Usage",
  BilledCost: 20,
  ServiceName: "Workers",
  CumulatedContractedCost: 100,
};
const now = new Date("2026-09-16T00:00:00Z");

async function fetchResponse(input: Record<string, unknown>, accountId: string, date: Date) {
  const server = setupServer(
    http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`, () =>
      HttpResponse.json(input),
    ),
  );
  server.listen({ onUnhandledRequest: "error" });
  try {
    return await fetchUsage(accountId, "test-token", date);
  } finally {
    server.close();
  }
}

test("aggregates daily actual costs instead of summing cumulative costs", async () => {
  const usage = await fetchResponse(
    { success: true, result: [record, { ...record, ServiceName: "D1", BilledCost: 12 }] },
    account,
    now,
  );
  expect(usage.usageUsd).toBe(32);
  const decision = evaluateBudget(usage, parseBudgetConfig(rawConfig));
  expect(decision.allowanceUsd).toBe(40);
  expect(decision.level).toBe(80);
  expect(decision.estimatedTotalJpy).toBe(3700);
  expect(shouldNotify(decision, [])).toBe(true);
  expect(shouldNotify(decision, [decision.notificationKey])).toBe(false);
});

test.each([
  [0, 0],
  [31.99, 0],
  [32, 80],
  [39.99, 80],
  [40, 100],
  [50, 100],
] as const)("classifies actual USD %s at level %s", async (usageUsd, expected) => {
  const usage = await fetchResponse(
    { success: true, result: [{ ...record, BilledCost: usageUsd }] },
    account,
    now,
  );
  const decision = evaluateBudget(usage, parseBudgetConfig(rawConfig));
  expect(decision.level).toBe(expected);
  expect(shouldNotify(decision, [])).toBe(expected !== 0);
});

test("missing cost, failed API envelope and empty usage are not treated as zero", async () => {
  await expect(fetchResponse({ success: true, result: [] }, account, now)).rejects.toThrow(
    "billing_response_invalid",
  );
  await expect(fetchResponse({ success: false, result: [record] }, account, now)).rejects.toThrow(
    "billing_response_invalid",
  );
  await expect(
    fetchResponse({ success: true, result: [{ ...record, BilledCost: null }] }, account, now),
  ).rejects.toThrow("billing_response_invalid");
});

test("rejects wrong account, currency, duplicate rows and ambiguous billing cycles", async () => {
  await expect(
    fetchResponse({ success: true, result: [record] }, "b".repeat(32), now),
  ).rejects.toThrow("billing_account_mismatch");
  await expect(
    fetchResponse({ success: true, result: [{ ...record, BillingCurrency: "JPY" }] }, account, now),
  ).rejects.toThrow("billing_response_invalid");
  await expect(
    fetchResponse({ success: true, result: [record, record] }, account, now),
  ).rejects.toThrow("billing_duplicate_record");
  await expect(
    fetchResponse(
      {
        success: true,
        result: [record, { ...record, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
      },
      account,
      now,
    ),
  ).rejects.toThrow("billing_period_ambiguous");
});

test("stale data and a budget consumed by fixed fees fail closed", async () => {
  await expect(
    fetchResponse({ success: true, result: [record] }, account, new Date("2026-09-20T00:00:00Z")),
  ).rejects.toThrow("billing_data_stale");
  expect(() => parseBudgetConfig({ ...rawConfig, FIXED_COST_USD: "50" })).toThrow(
    "budget_has_no_usage_allowance",
  );
  expect(() => parseBudgetConfig({ ...rawConfig, JPY_PER_USD: "0" })).toThrow(
    "budget_config_invalid",
  );
});

test("a new billing cycle permits notification again", async () => {
  const config = parseBudgetConfig(rawConfig);
  const usage = await fetchResponse({ success: true, result: [record] }, account, now);
  const current = evaluateBudget({ ...usage, usageUsd: 40 }, config);
  const next = evaluateBudget(
    { ...usage, periodStart: "2026-10-01T00:00:00Z", usageUsd: 40 },
    config,
  );
  expect(shouldNotify(next, [current.notificationKey])).toBe(true);
});
