import { CloudflareId } from "@repo/config";
import { DateTime, Duration, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { BudgetFailure, fail } from "./config.ts";

const MILLISECONDS_PER_HOUR = 3_600_000;
const FUTURE_CHARGE_TOLERANCE_HOURS = 24;
const MAX_DATA_AGE_HOURS = 48;
const isCloudflareId = Schema.is(CloudflareId);
const REQUEST_TIMEOUT_MS = 15_000;
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const billingHttp = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
);

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

type UsageRecord = typeof UsageRow.Type;

interface UsageSnapshot {
  periodStart: string;
  measuredThrough: string;
  usageUsd: number;
  records: number;
}

interface RowExpectation {
  accountId: string;
  periodStart: string;
  now: number;
}

function billingPeriodStart(rows: readonly UsageRecord[]): Effect.Effect<string, BudgetFailure> {
  const starts = new Set(rows.map((item) => item.BillingPeriodStart));
  const [periodStart] = starts;
  return starts.size === 1 && periodStart !== undefined
    ? Effect.succeed(periodStart)
    : fail("billing_period_ambiguous");
}

function rowFailure(
  item: UsageRecord,
  expectation: Readonly<RowExpectation>,
): BudgetFailure["code"] | undefined {
  if (item.BillingAccountId !== expectation.accountId) {
    return "billing_account_mismatch";
  }
  const start = Date.parse(item.ChargePeriodStart);
  const end = Date.parse(item.ChargePeriodEnd);
  const outOfPeriod =
    start < Date.parse(expectation.periodStart) ||
    end <= start ||
    start > expectation.now ||
    end > expectation.now + FUTURE_CHARGE_TOLERANCE_HOURS * MILLISECONDS_PER_HOUR;
  return outOfPeriod ? "billing_dates_invalid" : undefined;
}

function hasDuplicateRows(rows: readonly UsageRecord[]): Effect.Effect<boolean> {
  return Effect.forEach(rows, (item) =>
    encodeJson([
      item.SubscriptionId,
      item.ZoneId,
      item.ServiceName,
      item.ChargePeriodStart,
      item.ChargePeriodEnd,
    ]).pipe(Effect.orDie),
  ).pipe(Effect.map((keys) => new Set(keys).size !== rows.length));
}

function latestChargeEnd(
  rows: readonly UsageRecord[],
  now: number,
): Effect.Effect<number, BudgetFailure> {
  const latest = Math.max(...rows.map((item) => Date.parse(item.ChargePeriodEnd)));
  return now - latest > MAX_DATA_AGE_HOURS * MILLISECONDS_PER_HOUR
    ? fail("billing_data_stale")
    : Effect.succeed(latest);
}

function totalCost(rows: readonly UsageRecord[]): Effect.Effect<number, BudgetFailure> {
  const total = rows.reduce((sum, item) => sum + item.BilledCost, 0);
  return Number.isFinite(total) ? Effect.succeed(total) : fail("billing_cost_invalid");
}

const summarizeUsage = Effect.fn("summarizeUsage")(function* summarizeUsage(
  input: unknown,
  accountId: string,
  now: number,
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
  if (yield* hasDuplicateRows(rows)) {
    return yield* fail("billing_duplicate_record");
  }
  const snapshot: UsageSnapshot = {
    measuredThrough: DateTime.formatIso(DateTime.makeUnsafe(yield* latestChargeEnd(rows, now))),
    periodStart,
    records: rows.length,
    usageUsd: yield* totalCost(rows),
  };
  return snapshot;
});

function httpFailed(): BudgetFailure {
  return new BudgetFailure({ code: "billing_http_failed" });
}

const fetchUsage = Effect.fn("fetchUsage")(function* fetchUsage(
  accountId: string,
  token: string,
  now: number,
) {
  if (!isCloudflareId(accountId)) {
    return yield* fail("billing_account_invalid");
  }
  const response = yield* HttpClient.get(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    },
  ).pipe(
    Effect.timeout(Duration.millis(REQUEST_TIMEOUT_MS)),
    Effect.provide(billingHttp),
    Effect.mapError(httpFailed),
  );
  if (response.status < 200 || response.status >= 300) {
    return yield* fail("billing_http_failed");
  }
  const body = yield* response.json.pipe(
    Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })),
  );
  return yield* summarizeUsage(body, accountId, now);
});

export { fetchUsage };
export type { UsageSnapshot };
