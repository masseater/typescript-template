import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { billableUsageEndpoint, fetchUsage } from "./billing.ts";
import { BudgetFailure, parseBudgetConfig } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

const ACCOUNT_ID_LENGTH = 32;
const WORKERS_COST_USD = 20;
const D1_COST_USD = 12;
const ALLOWANCE_USD = 40;
const WARNING_USD = 32;
const OVERSPENT_USD = 50;
const CENT = 0.01;
const ESTIMATED_TOTAL_JPY = 3700;
const BUDGET_JPY = 5000;
const JPY_PER_USD = 100;
const FIXED_COST_USD = 5;
const RESERVE_USD = 5;

const accountId = "a".repeat(ACCOUNT_ID_LENGTH);
const otherAccountId = "b".repeat(ACCOUNT_ID_LENGTH);
const staleObservedAt = new Date("2026-09-20T00:00:00Z");
const observedAt = new Date("2026-09-16T00:00:00Z");
const rawConfig = {
  BILLING_READ_TOKEN: "test-read-only-token-not-a-secret",
  BUDGET_JPY: "5000",
  CLOUDFLARE_ACCOUNT_ID: accountId,
  FIXED_COST_USD: "5",
  JPY_PER_USD: "100",
  RESERVE_USD: "5",
} as const;

const usageRow = {
  BilledCost: WORKERS_COST_USD,
  BillingAccountId: accountId,
  BillingCurrency: "USD",
  BillingPeriodStart: "2026-09-01T00:00:00Z",
  ChargeCategory: "Usage",
  ChargePeriodEnd: "2026-09-15T00:00:00Z",
  ChargePeriodStart: "2026-09-14T00:00:00Z",
  CumulatedContractedCost: 100,
  ServiceName: "Workers",
} as const;

const warningNotificationKey = JSON.stringify([
  "2026-09-01T00:00:00Z",
  BUDGET_JPY,
  JPY_PER_USD,
  FIXED_COST_USD,
  RESERVE_USD,
  80,
]);

describe("budget usage and alerts", () => {
  const it = test.extend("warningDecision", async ({}, { onCleanup }) => {
    const billingApi = setupServer(
      http.get(billableUsageEndpoint(accountId), () =>
        HttpResponse.json({
          result: [usageRow, { ...usageRow, BilledCost: D1_COST_USD, ServiceName: "D1" }],
          success: true,
        }),
      ),
    );
    billingApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      billingApi.close();
    });
    const usage = await Effect.runPromise(
      fetchUsage({
        accountId,
        observedAt,
        token: "test-token",
        usageEndpoint: billableUsageEndpoint(accountId),
      }),
    );
    const config = await Effect.runPromise(parseBudgetConfig(rawConfig));
    return Effect.runPromise(evaluateBudget(usage, config));
  });

  it("aggregates daily costs and warns near the allowance", ({ warningDecision }) => {
    expect(warningDecision).toStrictEqual({
      allowanceUsd: ALLOWANCE_USD,
      estimatedTotalJpy: ESTIMATED_TOTAL_JPY,
      level: 80,
      notificationKey: warningNotificationKey,
      periodStart: "2026-09-01T00:00:00Z",
      usageUsd: WARNING_USD,
    });
  });
});

describe("warning notification gating", () => {
  const it = test
    .extend("notifyWhenUnseen", async () => {
      const config = await Effect.runPromise(parseBudgetConfig(rawConfig));
      const warningDecision = await Effect.runPromise(
        evaluateBudget(
          {
            measuredThrough: "2026-09-15T00:00:00.000Z",
            periodStart: "2026-09-01T00:00:00Z",
            records: 1,
            usageUsd: WARNING_USD,
          },
          config,
        ),
      );
      return shouldNotify(warningDecision, []);
    })
    .extend("notifyWhenSeen", async () => {
      const config = await Effect.runPromise(parseBudgetConfig(rawConfig));
      const warningDecision = await Effect.runPromise(
        evaluateBudget(
          {
            measuredThrough: "2026-09-15T00:00:00.000Z",
            periodStart: "2026-09-01T00:00:00Z",
            records: 1,
            usageUsd: WARNING_USD,
          },
          config,
        ),
      );
      return shouldNotify(warningDecision, [warningDecision.notificationKey]);
    });

  it("notifies when the warning key is unseen", ({ notifyWhenUnseen }) => {
    expect(notifyWhenUnseen).toBe(true);
  });

  it("stays quiet when the warning key was already sent", ({ notifyWhenSeen }) => {
    expect(notifyWhenSeen).toBe(false);
  });
});

describe.for([
  [0, 0],
  [WARNING_USD - CENT, 0],
  [WARNING_USD, 80],
  [ALLOWANCE_USD - CENT, 80],
  [ALLOWANCE_USD, 100],
  [OVERSPENT_USD, 100],
] as const)("usage USD %s", ([usageUsd, alertLevel]) => {
  const it = test.extend("classifiedDecision", async () => {
    const config = await Effect.runPromise(parseBudgetConfig(rawConfig));
    return Effect.runPromise(
      evaluateBudget(
        {
          measuredThrough: "2026-09-15T00:00:00.000Z",
          periodStart: "2026-09-01T00:00:00Z",
          records: 1,
          usageUsd,
        },
        config,
      ),
    );
  });

  it("maps the usage onto the alert decision", ({ classifiedDecision }) => {
    expect(classifiedDecision).toStrictEqual({
      allowanceUsd: ALLOWANCE_USD,
      estimatedTotalJpy: (usageUsd + FIXED_COST_USD) * JPY_PER_USD,
      level: alertLevel,
      notificationKey: JSON.stringify([
        "2026-09-01T00:00:00Z",
        BUDGET_JPY,
        JPY_PER_USD,
        FIXED_COST_USD,
        RESERVE_USD,
        alertLevel,
      ]),
      periodStart: "2026-09-01T00:00:00Z",
      usageUsd,
    });
  });
});

describe.for([
  ["empty", { result: [], success: true }, accountId, observedAt, "billing_response_invalid"],
  [
    "failed envelope",
    { result: [usageRow], success: false },
    accountId,
    observedAt,
    "billing_response_invalid",
  ],
  [
    "null cost",
    { result: [{ ...usageRow, BilledCost: null }], success: true },
    accountId,
    observedAt,
    "billing_response_invalid",
  ],
  [
    "wrong account",
    { result: [usageRow], success: true },
    otherAccountId,
    observedAt,
    "billing_account_mismatch",
  ],
  [
    "wrong currency",
    { result: [{ ...usageRow, BillingCurrency: "JPY" }], success: true },
    accountId,
    observedAt,
    "billing_response_invalid",
  ],
  [
    "duplicate",
    { result: [usageRow, usageRow], success: true },
    accountId,
    observedAt,
    "billing_duplicate_record",
  ],
  [
    "ambiguous period",
    {
      result: [usageRow, { ...usageRow, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
      success: true,
    },
    accountId,
    observedAt,
    "billing_period_ambiguous",
  ],
  [
    "stale",
    { result: [usageRow], success: true },
    accountId,
    staleObservedAt,
    "billing_data_stale",
  ],
] as const)("%s", ([, envelope, billedAccountId, whenObserved, pinnedCode]) => {
  const it = test.extend("rejection", async ({}, { onCleanup }) => {
    const billingApi = setupServer(
      http.get(billableUsageEndpoint(billedAccountId), () => HttpResponse.json(envelope)),
    );
    billingApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      billingApi.close();
    });
    return Effect.runPromise(
      Effect.flip(
        fetchUsage({
          accountId: billedAccountId,
          observedAt: whenObserved,
          token: "test-token",
          usageEndpoint: billableUsageEndpoint(billedAccountId),
        }),
      ),
    );
  });

  it("fails closed", ({ rejection }) => {
    expect(rejection).toStrictEqual(new BudgetFailure({ code: pinnedCode }));
  });
});

describe("config refusals", () => {
  const it = test.extend("noAllowance", async () =>
    Effect.runPromise(Effect.flip(parseBudgetConfig({ ...rawConfig, FIXED_COST_USD: "50" }))));

  it("rejects a budget consumed by fixed fees", ({ noAllowance }) => {
    expect(noAllowance).toStrictEqual(new BudgetFailure({ code: "budget_has_no_usage_allowance" }));
  });
});

describe("invalid config", () => {
  const it = test.extend("invalidConfig", async () =>
    Effect.runPromise(Effect.flip(parseBudgetConfig({ ...rawConfig, JPY_PER_USD: "0" }))));

  it("rejects a non-positive exchange rate", ({ invalidConfig }) => {
    expect(invalidConfig).toStrictEqual(new BudgetFailure({ code: "budget_config_invalid" }));
  });
});

describe("notification cycle reset", () => {
  const it = test.extend("cycleAllowsNotify", async () => {
    const config = await Effect.runPromise(parseBudgetConfig(rawConfig));
    const priorCycle = await Effect.runPromise(
      evaluateBudget(
        {
          measuredThrough: "2026-09-15T00:00:00.000Z",
          periodStart: "2026-09-01T00:00:00Z",
          records: 1,
          usageUsd: ALLOWANCE_USD,
        },
        config,
      ),
    );
    const nextCycle = await Effect.runPromise(
      evaluateBudget(
        {
          measuredThrough: "2026-09-15T00:00:00.000Z",
          periodStart: "2026-10-01T00:00:00Z",
          records: 1,
          usageUsd: ALLOWANCE_USD,
        },
        config,
      ),
    );
    return shouldNotify(nextCycle, [priorCycle.notificationKey]);
  });

  it("notifies again when the billing period changes", ({ cycleAllowsNotify }) => {
    expect(cycleAllowsNotify).toBe(true);
  });
});
