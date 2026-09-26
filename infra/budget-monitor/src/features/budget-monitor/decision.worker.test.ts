import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { DateTime, Effect, Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpResponse, http } from "msw";

import { fetchUsage, type UsageSnapshot } from "./billing.ts";
import { parseBudgetConfig, type BudgetFailure } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";
import { fetchJpyPerUsd } from "./exchange-rate.ts";

const ACCOUNT_ID_LENGTH = 32;
const WORKERS_COST_USD = 20;
const D1_COST_USD = 12;
const ALLOWANCE_USD = 40;
const WARNING_USD = 32;
const OVERSPENT_USD = 50;
const CENT = 0.01;
const ESTIMATED_TOTAL_JPY = 3700;
const JPY_PER_USD = 100;
const MOVED_JPY_PER_USD = 99;
const NO_ALERT_LEVEL = 0;
const WARNING_LEVEL = 80;
const EXHAUSTED_LEVEL = 100;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const otherAccount = "b".repeat(ACCOUNT_ID_LENGTH);
const staleNow = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-20T00:00:00Z"));
const rawConfig = {
  BILLING_READ_TOKEN: "test-read-only-token-not-a-secret",
  BUDGET_JPY: "5000",
  CLOUDFLARE_ACCOUNT_ID: account,
};
const usageRecord = {
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
const observedAt = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-16T00:00:00Z"));

const usageFrom = (asked: {
  readonly accountId: string;
  readonly observedAt: number;
  readonly payload: Readonly<Record<string, unknown>>;
}): Effect.Effect<UsageSnapshot, BudgetFailure> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(
        http.get(
          `https://api.cloudflare.com/client/v4/accounts/${asked.accountId}/billable-usage`,
          () => HttpResponse.json(asked.payload),
        ),
      );
      network.enable();
      return network;
    }),
    () =>
      fetchUsage({
        accountId: asked.accountId,
        observedAt: asked.observedAt,
        token: Redacted.make("test-token"),
      }).pipe(Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch)),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );

function failureCodeOf<Value, Requirements>(
  effect: Effect.Effect<Value, BudgetFailure, Requirements>,
): Effect.Effect<BudgetFailure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

it.effect("aggregates daily actual costs instead of summing cumulative costs", () =>
  Effect.gen(function* program() {
    const usage = yield* usageFrom({
      accountId: account,
      observedAt: observedAt,
      payload: {
        result: [usageRecord, { ...usageRecord, BilledCost: D1_COST_USD, ServiceName: "D1" }],
        success: true,
      },
    });
    assert.strictEqual(usage.usageUsd, WARNING_USD);
    const decision = yield* evaluateBudget({
      config: yield* parseBudgetConfig(rawConfig),
      jpyPerUsd: JPY_PER_USD,
      snapshot: usage,
    });
    assert.strictEqual(decision.allowanceUsd, ALLOWANCE_USD);
    assert.strictEqual(decision.level, WARNING_LEVEL);
    assert.strictEqual(decision.estimatedTotalJpy, ESTIMATED_TOTAL_JPY);
    assert.isTrue(shouldNotify(decision, []));
    assert.isFalse(shouldNotify(decision, [decision.notificationKey]));
  }),
);

for (const [usageUsd, expectedLevel] of [
  [NO_ALERT_LEVEL, NO_ALERT_LEVEL],
  [WARNING_USD - CENT, NO_ALERT_LEVEL],
  [WARNING_USD, WARNING_LEVEL],
  [ALLOWANCE_USD - CENT, WARNING_LEVEL],
  [ALLOWANCE_USD, EXHAUSTED_LEVEL],
  [OVERSPENT_USD, EXHAUSTED_LEVEL],
] as const) {
  it.effect(`classifies actual USD ${usageUsd} at level ${expectedLevel}`, () =>
    Effect.gen(function* program() {
      const usage = yield* usageFrom({
        accountId: account,
        observedAt: observedAt,
        payload: { result: [{ ...usageRecord, BilledCost: usageUsd }], success: true },
      });
      const decision = yield* evaluateBudget({
        config: yield* parseBudgetConfig(rawConfig),
        jpyPerUsd: JPY_PER_USD,
        snapshot: usage,
      });
      assert.strictEqual(decision.level, expectedLevel);
      assert.strictEqual(shouldNotify(decision, []), expectedLevel !== NO_ALERT_LEVEL);
    }),
  );
}

it.effect("missing cost, failed API envelope and empty usage are not treated as zero", () =>
  Effect.gen(function* program() {
    for (const input of [
      { result: [], success: true },
      { result: [usageRecord], success: false },
      { result: [{ ...usageRecord, BilledCost: null }], success: true },
    ]) {
      assert.strictEqual(
        yield* failureCodeOf(
          usageFrom({ accountId: account, observedAt: observedAt, payload: input }),
        ),
        "billing_response_invalid",
      );
    }
  }),
);

it.effect("rejects wrong account, currency, duplicate rows and ambiguous billing cycles", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* failureCodeOf(
        usageFrom({
          accountId: otherAccount,
          observedAt: observedAt,
          payload: { result: [usageRecord], success: true },
        }),
      ),
      "billing_account_mismatch",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        usageFrom({
          accountId: account,
          observedAt: observedAt,
          payload: { result: [{ ...usageRecord, BillingCurrency: "JPY" }], success: true },
        }),
      ),
      "billing_response_invalid",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        usageFrom({
          accountId: account,
          observedAt: observedAt,
          payload: { result: [usageRecord, usageRecord], success: true },
        }),
      ),
      "billing_duplicate_record",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        usageFrom({
          accountId: account,
          observedAt: observedAt,
          payload: {
            result: [usageRecord, { ...usageRecord, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
            success: true,
          },
        }),
      ),
      "billing_period_ambiguous",
    );
  }),
);

it.effect("stale data and a budget consumed by fixed fees fail closed", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* failureCodeOf(
        usageFrom({
          accountId: account,
          observedAt: staleNow,
          payload: { result: [usageRecord], success: true },
        }),
      ),
      "billing_data_stale",
    );
    const usage = yield* usageFrom({
      accountId: account,
      observedAt: observedAt,
      payload: { result: [usageRecord], success: true },
    });
    assert.strictEqual(
      yield* failureCodeOf(
        evaluateBudget({
          config: yield* parseBudgetConfig({ ...rawConfig, BUDGET_JPY: "1000" }),
          jpyPerUsd: JPY_PER_USD,
          snapshot: usage,
        }),
      ),
      "budget_has_no_usage_allowance",
    );
    assert.strictEqual(
      yield* failureCodeOf(parseBudgetConfig({ ...rawConfig, BUDGET_JPY: "0" })),
      "budget_config_invalid",
    );
  }),
);

it.effect("a new billing cycle permits notification again", () =>
  Effect.gen(function* program() {
    const config = yield* parseBudgetConfig(rawConfig);
    const usage = yield* usageFrom({
      accountId: account,
      observedAt: observedAt,
      payload: { result: [usageRecord], success: true },
    });
    const priorDecision = yield* evaluateBudget({
      config: config,
      jpyPerUsd: JPY_PER_USD,
      snapshot: { ...usage, usageUsd: ALLOWANCE_USD },
    });
    const laterDecision = yield* evaluateBudget({
      config: config,
      jpyPerUsd: JPY_PER_USD,
      snapshot: { ...usage, periodStart: "2026-10-01T00:00:00Z", usageUsd: ALLOWANCE_USD },
    });
    assert.isTrue(shouldNotify(laterDecision, [priorDecision.notificationKey]));
  }),
);

it.effect("does not notify the same threshold again when only the exchange rate moves", () =>
  Effect.gen(function* program() {
    const config = yield* parseBudgetConfig(rawConfig);
    const usage = yield* usageFrom({
      accountId: account,
      observedAt: observedAt,
      payload: { result: [usageRecord], success: true },
    });
    const priorDecision = yield* evaluateBudget({
      config: config,
      jpyPerUsd: JPY_PER_USD,
      snapshot: { ...usage, usageUsd: OVERSPENT_USD },
    });
    const movedDecision = yield* evaluateBudget({
      config: config,
      jpyPerUsd: MOVED_JPY_PER_USD,
      snapshot: { ...usage, usageUsd: OVERSPENT_USD },
    });
    assert.strictEqual(movedDecision.jpyPerUsd, MOVED_JPY_PER_USD);
    assert.isFalse(shouldNotify(movedDecision, [priorDecision.notificationKey]));
  }),
);

const rateFrom = (asked: {
  readonly observedAt: number;
  readonly respond: () => Response;
}): Effect.Effect<number, BudgetFailure> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(http.get("https://api.frankfurter.dev/v1/latest", asked.respond));
      network.enable();
      return network;
    }),
    () => fetchJpyPerUsd(asked.observedAt),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );

const quote = { amount: 1, base: "USD", date: "2026-09-15", rates: { JPY: JPY_PER_USD } };

it.effect("reads the current yen rate for one US dollar", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* rateFrom({ observedAt: observedAt, respond: () => HttpResponse.json(quote) }),
      JPY_PER_USD,
    );
  }),
);

it.effect("an unavailable, malformed or stale exchange rate fails closed", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* failureCodeOf(
        rateFrom({
          observedAt: observedAt,
          respond: () => new HttpResponse(null, { status: 503 }),
        }),
      ),
      "exchange_rate_http_failed",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        rateFrom({
          observedAt: observedAt,
          respond: () => HttpResponse.json({ ...quote, rates: {} }),
        }),
      ),
      "exchange_rate_response_invalid",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        rateFrom({
          observedAt: observedAt,
          respond: () => HttpResponse.json({ ...quote, base: "EUR" }),
        }),
      ),
      "exchange_rate_response_invalid",
    );
    assert.strictEqual(
      yield* failureCodeOf(
        rateFrom({
          observedAt: observedAt,
          respond: () => HttpResponse.json({ ...quote, date: "2026-09-01" }),
        }),
      ),
      "exchange_rate_stale",
    );
  }),
);
