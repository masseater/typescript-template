import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { evaluateBudget, shouldNotify } from "./decision.ts";
import type { UsageSnapshot } from "./billing.ts";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { setupServer } from "msw/node";

const ACCOUNT_ID_LENGTH = 32;
const WORKERS_COST_USD = 20;
const D1_COST_USD = 12;
const ALLOWANCE_USD = 40;
const WARNING_USD = 32;
const OVERSPENT_USD = 50;
const CENT = 0.01;
const ESTIMATED_TOTAL_JPY = 3700;
const NO_ALERT_LEVEL = 0;
const WARNING_LEVEL = 80;
const EXHAUSTED_LEVEL = 100;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const rawConfig = {
  ALERT_FROM: "mail@example.com",
  ALERT_TO: "owner@example.com",
  BILLING_READ_TOKEN: "test-read-only-token-not-a-secret",
  BUDGET_JPY: "5000",
  CLOUDFLARE_ACCOUNT_ID: account,
  FIXED_COST_USD: "5",
  JPY_PER_USD: "100",
  RESERVE_USD: "5",
};
const record = {
  BilledCost: WORKERS_COST_USD,
  BillingAccountId: account,
  BillingCurrency: "USD",
  BillingPeriodStart: "2026-09-01T00:00:00Z",
  ChargeCategory: "Usage",
  ChargePeriodEnd: "2026-09-15T00:00:00Z",
  ChargePeriodStart: "2026-09-14T00:00:00Z",
  CumulatedContractedCost: 100,
  ServiceName: "Workers",
};
const now = new Date("2026-09-16T00:00:00Z");

async function fetchResponse(
  input: Readonly<Record<string, unknown>>,
  accountId: string,
  date: Readonly<Date>,
): Promise<UsageSnapshot> {
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

async function fetchDailyCosts(): Promise<UsageSnapshot> {
  return fetchResponse(
    { result: [record, { ...record, BilledCost: D1_COST_USD, ServiceName: "D1" }], success: true },
    account,
    now,
  );
}

describe("budget evaluation", () => {
  it("aggregates daily actual costs instead of summing cumulative costs", async () => {
    expect.hasAssertions();
    const usage = await fetchDailyCosts();
    expect(usage.usageUsd).toBe(WORKERS_COST_USD + D1_COST_USD);
    const decision = evaluateBudget(usage, parseBudgetConfig(rawConfig));
    expect(decision.allowanceUsd).toBe(ALLOWANCE_USD);
    expect(decision.level).toBe(WARNING_LEVEL);
    expect(decision.estimatedTotalJpy).toBe(ESTIMATED_TOTAL_JPY);
  });

  it("notifies once per threshold within a billing cycle", async () => {
    expect.hasAssertions();
    const decision = evaluateBudget(await fetchDailyCosts(), parseBudgetConfig(rawConfig));
    expect(shouldNotify(decision, [])).toBe(true);
    expect(shouldNotify(decision, [decision.notificationKey])).toBe(false);
  });
});

describe("budget alert levels", () => {
  it.each([
    [0, NO_ALERT_LEVEL],
    [WARNING_USD - CENT, NO_ALERT_LEVEL],
    [WARNING_USD, WARNING_LEVEL],
    [ALLOWANCE_USD - CENT, WARNING_LEVEL],
    [ALLOWANCE_USD, EXHAUSTED_LEVEL],
    [OVERSPENT_USD, EXHAUSTED_LEVEL],
  ] as const)("classifies actual USD %s at level %s", async (usageUsd, expected) => {
    expect.hasAssertions();
    const usage = await fetchResponse(
      { result: [{ ...record, BilledCost: usageUsd }], success: true },
      account,
      now,
    );
    const decision = evaluateBudget(usage, parseBudgetConfig(rawConfig));
    expect(decision.level).toBe(expected);
    expect(shouldNotify(decision, [])).toBe(expected !== NO_ALERT_LEVEL);
  });
});

describe("billable usage validation", () => {
  it("missing cost, failed API envelope and empty usage are not treated as zero", async () => {
    expect.hasAssertions();
    await expect(fetchResponse({ result: [], success: true }, account, now)).rejects.toThrow(
      "billing_response_invalid",
    );
    await expect(fetchResponse({ result: [record], success: false }, account, now)).rejects.toThrow(
      "billing_response_invalid",
    );
    await expect(
      fetchResponse({ result: [{ ...record, BilledCost: null }], success: true }, account, now),
    ).rejects.toThrow("billing_response_invalid");
  });

  it("rejects wrong account, currency, duplicate rows and ambiguous billing cycles", async () => {
    expect.hasAssertions();
    await expect(
      fetchResponse({ result: [record], success: true }, "b".repeat(ACCOUNT_ID_LENGTH), now),
    ).rejects.toThrow("billing_account_mismatch");
    await expect(
      fetchResponse(
        { result: [{ ...record, BillingCurrency: "JPY" }], success: true },
        account,
        now,
      ),
    ).rejects.toThrow("billing_response_invalid");
    await expect(
      fetchResponse({ result: [record, record], success: true }, account, now),
    ).rejects.toThrow("billing_duplicate_record");
    await expect(
      fetchResponse(
        {
          result: [record, { ...record, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
          success: true,
        },
        account,
        now,
      ),
    ).rejects.toThrow("billing_period_ambiguous");
  });
});

describe("fail-closed budget inputs", () => {
  it("stale data and a budget consumed by fixed fees fail closed", async () => {
    expect.hasAssertions();
    await expect(
      fetchResponse({ result: [record], success: true }, account, new Date("2026-09-20T00:00:00Z")),
    ).rejects.toThrow("billing_data_stale");
    expect(() => parseBudgetConfig({ ...rawConfig, FIXED_COST_USD: "50" })).toThrow(
      "budget_has_no_usage_allowance",
    );
    expect(() => parseBudgetConfig({ ...rawConfig, JPY_PER_USD: "0" })).toThrow(
      "budget_config_invalid",
    );
  });

  it("a new billing cycle permits notification again", async () => {
    expect.hasAssertions();
    const config = parseBudgetConfig(rawConfig);
    const usage = await fetchResponse({ result: [record], success: true }, account, now);
    const current = evaluateBudget({ ...usage, usageUsd: ALLOWANCE_USD }, config);
    const next = evaluateBudget(
      { ...usage, periodStart: "2026-10-01T00:00:00Z", usageUsd: ALLOWANCE_USD },
      config,
    );
    expect(shouldNotify(next, [current.notificationKey])).toBe(true);
  });
});
