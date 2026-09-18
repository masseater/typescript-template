import { Effect, Schema } from "effect";

import { BudgetFailure, fail } from "./config.ts";

const MILLISECONDS_PER_HOUR = 3_600_000;
const FUTURE_CHARGE_TOLERANCE_HOURS = 24;
const MAX_DATA_AGE_HOURS = 48;
const REQUEST_TIMEOUT_MS = 15_000;

const Timestamp = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
      !Number.isNaN(Date.parse(value)),
  ),
);
const Cost = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const OptionalIdentifier = Schema.optionalKey(Schema.NullOr(Schema.String));
const UsageRow = Schema.Struct({
  BilledCost: Cost,
  BillingAccountId: Schema.String,
  BillingCurrency: Schema.Literal("USD"),
  BillingPeriodStart: Timestamp,
  ChargeCategory: Schema.Literal("Usage"),
  ChargePeriodEnd: Timestamp,
  ChargePeriodStart: Timestamp,
  ServiceName: Schema.String.check(Schema.isMinLength(1)),
  SubscriptionId: OptionalIdentifier,
  ZoneId: OptionalIdentifier,
});
const UsageEnvelope = Schema.Struct({
  result: Schema.Array(UsageRow).check(Schema.isMinLength(1)),
  success: Schema.Literal(true),
});

interface UsageSnapshot {
  periodStart: string;
  measuredThrough: string;
  usageUsd: number;
  records: number;
}

interface RowExpectation {
  accountId: string;
  periodStart: string;
  now: Readonly<Date>;
}

type UsageRecord = typeof UsageRow.Type;

const billingPeriodStart = (rows: readonly UsageRecord[]): Effect.Effect<string, BudgetFailure> => {
  const starts = new Set(rows.map((item) => item.BillingPeriodStart));
  const [periodStart] = starts;
  return starts.size === 1 && periodStart !== undefined
    ? Effect.succeed(periodStart)
    : fail("billing_period_ambiguous");
};

const rowFailure = (
  item: UsageRecord,
  expectation: Readonly<RowExpectation>,
): BudgetFailure["code"] | undefined => {
  if (item.BillingAccountId !== expectation.accountId) {
    return "billing_account_mismatch";
  }
  const start = Date.parse(item.ChargePeriodStart);
  const end = Date.parse(item.ChargePeriodEnd);
  const now = expectation.now.getTime();
  const outOfPeriod =
    start < Date.parse(expectation.periodStart) ||
    end <= start ||
    start > now ||
    end > now + FUTURE_CHARGE_TOLERANCE_HOURS * MILLISECONDS_PER_HOUR;
  return outOfPeriod ? "billing_dates_invalid" : undefined;
};

const hasDuplicateRows = (rows: readonly UsageRecord[]): boolean => {
  const keys = new Set(
    rows.map((item) =>
      JSON.stringify([
        item.SubscriptionId,
        item.ZoneId,
        item.ServiceName,
        item.ChargePeriodStart,
        item.ChargePeriodEnd,
      ]),
    ),
  );
  return keys.size !== rows.length;
};

const latestChargeEnd = (
  rows: readonly UsageRecord[],
  now: Readonly<Date>,
): Effect.Effect<number, BudgetFailure> => {
  const latest = Math.max(...rows.map((item) => Date.parse(item.ChargePeriodEnd)));
  return now.getTime() - latest > MAX_DATA_AGE_HOURS * MILLISECONDS_PER_HOUR
    ? fail("billing_data_stale")
    : Effect.succeed(latest);
};

const totalCost = (rows: readonly UsageRecord[]): Effect.Effect<number, BudgetFailure> => {
  const total = rows.reduce((sum, item) => sum + item.BilledCost, 0);
  return Number.isFinite(total) ? Effect.succeed(total) : fail("billing_cost_invalid");
};

const summarizeUsage = Effect.fn("summarizeUsage")(function* summarizeUsage(
  input: unknown,
  accountId: string,
  now: Readonly<Date>,
) {
  const { result: rows } = yield* Schema.decodeUnknownEffect(UsageEnvelope)(input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })),
  );
  const periodStart = yield* billingPeriodStart(rows);
  const invalid = rows
    .map((item) => rowFailure(item, { accountId, now, periodStart }))
    .find((code) => code !== undefined);
  if (invalid !== undefined) {
    return yield* fail(invalid);
  }
  if (hasDuplicateRows(rows)) {
    return yield* fail("billing_duplicate_record");
  }
  const snapshot: UsageSnapshot = {
    measuredThrough: new Date(yield* latestChargeEnd(rows, now)).toISOString(),
    periodStart,
    records: rows.length,
    usageUsd: yield* totalCost(rows),
  };
  return snapshot;
});

const httpFailed = (): BudgetFailure => {
  return new BudgetFailure({ code: "billing_http_failed" });
};

const fetchUsage = Effect.fn("fetchUsage")(function* fetchUsage(
  accountId: string,
  token: string,
  now: Readonly<Date>,
) {
  if (!/^[a-f0-9]{32}$/u.test(accountId)) {
    return yield* fail("billing_account_invalid");
  }
  const response = yield* Effect.tryPromise({
    catch: httpFailed,

    try: async (signal) =>
      fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      }),
  });
  if (!response.ok) {
    return yield* fail("billing_http_failed");
  }
  const body = yield* Effect.tryPromise({
    catch: () => new BudgetFailure({ code: "billing_response_invalid" }),
    try: async (): Promise<unknown> => response.json(),
  });
  return yield* summarizeUsage(body, accountId, now);
});

export { fetchUsage };
export type { UsageSnapshot };
