import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

import type { UsageSnapshot } from "./billing.ts";
import type { BudgetFailure } from "./config.ts";

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
const otherAccount = "b".repeat(ACCOUNT_ID_LENGTH);
const staleNow = new Date("2026-09-20T00:00:00Z");
const rawConfig = {
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

function usageFrom(
  input: Readonly<Record<string, unknown>>,
  accountId: string,
  date: Date,
): Effect.Effect<UsageSnapshot, BudgetFailure> {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(
        http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`, () =>
          HttpResponse.json(input),
        ),
      );
      network.enable();
      return network;
    }),
    () => fetchUsage(accountId, "test-token", date),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

function code<Value, Requirements>(
  effect: Effect.Effect<Value, BudgetFailure, Requirements>,
): Effect.Effect<BudgetFailure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

it.effect("aggregates daily actual costs instead of summing cumulative costs", () =>
  Effect.gen(function* program() {
    const usage = yield* usageFrom(
      {
        result: [record, { ...record, BilledCost: D1_COST_USD, ServiceName: "D1" }],
        success: true,
      },
      account,
      now,
    );
    assert.strictEqual(usage.usageUsd, WARNING_USD);
    const decision = yield* evaluateBudget(usage, yield* parseBudgetConfig(rawConfig));
    assert.strictEqual(decision.allowanceUsd, ALLOWANCE_USD);
    assert.strictEqual(decision.level, WARNING_LEVEL);
    assert.strictEqual(decision.estimatedTotalJpy, ESTIMATED_TOTAL_JPY);
    assert.isTrue(shouldNotify(decision, []));
    assert.isFalse(shouldNotify(decision, [decision.notificationKey]));
  }),
);

for (const [usageUsd, expected] of [
  [NO_ALERT_LEVEL, NO_ALERT_LEVEL],
  [WARNING_USD - CENT, NO_ALERT_LEVEL],
  [WARNING_USD, WARNING_LEVEL],
  [ALLOWANCE_USD - CENT, WARNING_LEVEL],
  [ALLOWANCE_USD, EXHAUSTED_LEVEL],
  [OVERSPENT_USD, EXHAUSTED_LEVEL],
] as const) {
  it.effect(`classifies actual USD ${usageUsd} at level ${expected}`, () =>
    Effect.gen(function* program() {
      const usage = yield* usageFrom(
        { result: [{ ...record, BilledCost: usageUsd }], success: true },
        account,
        now,
      );
      const decision = yield* evaluateBudget(usage, yield* parseBudgetConfig(rawConfig));
      assert.strictEqual(decision.level, expected);
      assert.strictEqual(shouldNotify(decision, []), expected !== NO_ALERT_LEVEL);
    }),
  );
}

it.effect("missing cost, failed API envelope and empty usage are not treated as zero", () =>
  Effect.gen(function* program() {
    for (const input of [
      { result: [], success: true },
      { result: [record], success: false },
      // oxlint-disable-next-line unicorn/no-null -- the billing API sends BilledCost as JSON null when a row has no cost, and that payload is what this test rejects
      { result: [{ ...record, BilledCost: null }], success: true },
    ]) {
      assert.strictEqual(yield* code(usageFrom(input, account, now)), "billing_response_invalid");
    }
  }),
);

it.effect("rejects wrong account, currency, duplicate rows and ambiguous billing cycles", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(usageFrom({ result: [record], success: true }, otherAccount, now)),
      "billing_account_mismatch",
    );
    assert.strictEqual(
      yield* code(
        usageFrom({ result: [{ ...record, BillingCurrency: "JPY" }], success: true }, account, now),
      ),
      "billing_response_invalid",
    );
    assert.strictEqual(
      yield* code(usageFrom({ result: [record, record], success: true }, account, now)),
      "billing_duplicate_record",
    );
    assert.strictEqual(
      yield* code(
        usageFrom(
          {
            result: [record, { ...record, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
            success: true,
          },
          account,
          now,
        ),
      ),
      "billing_period_ambiguous",
    );
  }),
);

it.effect("stale data and a budget consumed by fixed fees fail closed", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(usageFrom({ result: [record], success: true }, account, staleNow)),
      "billing_data_stale",
    );
    assert.strictEqual(
      yield* code(parseBudgetConfig({ ...rawConfig, FIXED_COST_USD: "50" })),
      "budget_has_no_usage_allowance",
    );
    assert.strictEqual(
      yield* code(parseBudgetConfig({ ...rawConfig, JPY_PER_USD: "0" })),
      "budget_config_invalid",
    );
  }),
);

it.effect("a new billing cycle permits notification again", () =>
  Effect.gen(function* program() {
    const config = yield* parseBudgetConfig(rawConfig);
    const usage = yield* usageFrom({ result: [record], success: true }, account, now);
    const current = yield* evaluateBudget({ ...usage, usageUsd: ALLOWANCE_USD }, config);
    const next = yield* evaluateBudget(
      { ...usage, periodStart: "2026-10-01T00:00:00Z", usageUsd: ALLOWANCE_USD },
      config,
    );
    assert.isTrue(shouldNotify(next, [current.notificationKey]));
  }),
);
