import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import type { BudgetFailure } from "./config.ts";
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

const usageFrom = (input: Record<string, unknown>, accountId: string, date: Date) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const server = setupServer(
        http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`, () =>
          HttpResponse.json(input),
        ),
      );
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    () => fetchUsage(accountId, "test-token", date),
    (server) => Effect.sync(() => server.close()),
  );

const code = <A, R>(effect: Effect.Effect<A, BudgetFailure, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

it.effect("aggregates daily actual costs instead of summing cumulative costs", () =>
  Effect.gen(function* () {
    const usage = yield* usageFrom(
      { success: true, result: [record, { ...record, ServiceName: "D1", BilledCost: 12 }] },
      account,
      now,
    );
    assert.strictEqual(usage.usageUsd, 32);
    const decision = yield* evaluateBudget(usage, yield* parseBudgetConfig(rawConfig));
    assert.strictEqual(decision.allowanceUsd, 40);
    assert.strictEqual(decision.level, 80);
    assert.strictEqual(decision.estimatedTotalJpy, 3700);
    assert.isTrue(shouldNotify(decision, []));
    assert.isFalse(shouldNotify(decision, [decision.notificationKey]));
  }),
);

for (const [usageUsd, expected] of [
  [0, 0],
  [31.99, 0],
  [32, 80],
  [39.99, 80],
  [40, 100],
  [50, 100],
] as const)
  it.effect(`classifies actual USD ${usageUsd} at level ${expected}`, () =>
    Effect.gen(function* () {
      const usage = yield* usageFrom(
        { success: true, result: [{ ...record, BilledCost: usageUsd }] },
        account,
        now,
      );
      const decision = yield* evaluateBudget(usage, yield* parseBudgetConfig(rawConfig));
      assert.strictEqual(decision.level, expected);
      assert.strictEqual(shouldNotify(decision, []), expected !== 0);
    }),
  );

it.effect("missing cost, failed API envelope and empty usage are not treated as zero", () =>
  Effect.gen(function* () {
    for (const input of [
      { success: true, result: [] },
      { success: false, result: [record] },
      { success: true, result: [{ ...record, BilledCost: null }] },
    ])
      assert.strictEqual(yield* code(usageFrom(input, account, now)), "billing_response_invalid");
  }),
);

it.effect("rejects wrong account, currency, duplicate rows and ambiguous billing cycles", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(usageFrom({ success: true, result: [record] }, "b".repeat(32), now)),
      "billing_account_mismatch",
    );
    assert.strictEqual(
      yield* code(
        usageFrom({ success: true, result: [{ ...record, BillingCurrency: "JPY" }] }, account, now),
      ),
      "billing_response_invalid",
    );
    assert.strictEqual(
      yield* code(usageFrom({ success: true, result: [record, record] }, account, now)),
      "billing_duplicate_record",
    );
    assert.strictEqual(
      yield* code(
        usageFrom(
          {
            success: true,
            result: [record, { ...record, BillingPeriodStart: "2026-09-02T00:00:00Z" }],
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
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(
        usageFrom({ success: true, result: [record] }, account, new Date("2026-09-20T00:00:00Z")),
      ),
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
  Effect.gen(function* () {
    const config = yield* parseBudgetConfig(rawConfig);
    const usage = yield* usageFrom({ success: true, result: [record] }, account, now);
    const current = yield* evaluateBudget({ ...usage, usageUsd: 40 }, config);
    const next = yield* evaluateBudget(
      { ...usage, periodStart: "2026-10-01T00:00:00Z", usageUsd: 40 },
      config,
    );
    assert.isTrue(shouldNotify(next, [current.notificationKey]));
  }),
);
