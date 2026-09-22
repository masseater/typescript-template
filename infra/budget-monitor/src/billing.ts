import { CloudflareId } from "@repo/config";
import { DateTime, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { BudgetFailure, fail } from "./config.ts";

const MILLISECONDS_PER_HOUR = 3_600_000;
const FUTURE_CHARGE_TOLERANCE_HOURS = 24;
const MAX_DATA_AGE_HOURS = 48;
const isCloudflareId = Schema.is(CloudflareId);
const encodeUsageKey = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const IsoTimestamp = Schema.String.check(
  Schema.makeFilter(
    (isoText: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(isoText) &&
      !Number.isNaN(Date.parse(isoText)),
  ),
);
const Cost = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const OptionalIdentifier = Schema.optionalKey(Schema.NullOr(Schema.String));
const UsageRow = Schema.Struct({
  BilledCost: Cost,
  BillingAccountId: Schema.String,
  BillingCurrency: Schema.Literal("USD"),
  BillingPeriodStart: IsoTimestamp,
  ChargeCategory: Schema.Literal("Usage"),
  ChargePeriodEnd: IsoTimestamp,
  ChargePeriodStart: IsoTimestamp,
  ServiceName: Schema.String.check(Schema.isMinLength(1)),
  SubscriptionId: OptionalIdentifier,
  ZoneId: OptionalIdentifier,
});
const UsageEnvelope = Schema.Struct({
  result: Schema.Array(UsageRow).check(Schema.isMinLength(1)),
  success: Schema.Literal(true),
});

type UsageSnapshot = {
  readonly periodStart: string;
  readonly measuredThrough: string;
  readonly usageUsd: number;
  readonly records: number;
};

type RowExpectation = {
  readonly accountId: string;
  readonly periodStart: string;
  readonly observedAt: number;
};

const billableUsageEndpoint = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`;

type UsageRecord = typeof UsageRow.Type;

const billingPeriodStart = (
  usageRows: readonly UsageRecord[],
): Effect.Effect<string, BudgetFailure> => {
  const starts = new Set(usageRows.map((usageRow) => usageRow.BillingPeriodStart));
  const [periodStart] = starts;
  return starts.size === 1 && periodStart !== undefined
    ? Effect.succeed(periodStart)
    : fail("billing_period_ambiguous");
};

const rowFailure = (
  usageRow: UsageRecord,
  expectation: Readonly<RowExpectation>,
): BudgetFailure["code"] | undefined => {
  if (usageRow.BillingAccountId !== expectation.accountId) {
    return "billing_account_mismatch";
  }
  const chargeStart = Date.parse(usageRow.ChargePeriodStart);
  const chargeEnd = Date.parse(usageRow.ChargePeriodEnd);
  const outOfPeriod =
    chargeStart < Date.parse(expectation.periodStart) ||
    chargeEnd <= chargeStart ||
    chargeStart > expectation.observedAt ||
    chargeEnd > expectation.observedAt + FUTURE_CHARGE_TOLERANCE_HOURS * MILLISECONDS_PER_HOUR;
  return outOfPeriod ? "billing_dates_invalid" : undefined;
};

const hasDuplicateRows = (usageRows: readonly UsageRecord[]): Effect.Effect<boolean> =>
  Effect.forEach(usageRows, (usageRow) =>
    encodeUsageKey([
      usageRow.SubscriptionId,
      usageRow.ZoneId,
      usageRow.ServiceName,
      usageRow.ChargePeriodStart,
      usageRow.ChargePeriodEnd,
    ]).pipe(Effect.orDie),
  ).pipe(Effect.map((encodedRowKeys) => new Set(encodedRowKeys).size !== usageRows.length));

const latestChargeEnd = (asked: {
  readonly usageRows: readonly UsageRecord[];
  readonly observedAt: number;
}): Effect.Effect<number, BudgetFailure> => {
  const latest = Math.max(
    ...asked.usageRows.map((usageRow) => Date.parse(usageRow.ChargePeriodEnd)),
  );
  return asked.observedAt - latest > MAX_DATA_AGE_HOURS * MILLISECONDS_PER_HOUR
    ? fail("billing_data_stale")
    : Effect.succeed(latest);
};

const totalCost = (usageRows: readonly UsageRecord[]): Effect.Effect<number, BudgetFailure> => {
  const usageTotal = usageRows.reduce((sum, usageRow) => sum + usageRow.BilledCost, 0);
  return Number.isFinite(usageTotal) ? Effect.succeed(usageTotal) : fail("billing_cost_invalid");
};

const summarizeUsage = Effect.fn("summarizeUsage")(function* summarizeUsage(asked: {
  readonly accountId: string;
  readonly observedAt: number;
  readonly payload: unknown;
}) {
  const { result: usageRows } = yield* Schema.decodeUnknownEffect(UsageEnvelope)(
    asked.payload,
  ).pipe(Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })));
  const periodStart = yield* billingPeriodStart(usageRows);
  const invalid = usageRows
    .map((usageRow) =>
      rowFailure(usageRow, {
        accountId: asked.accountId,
        observedAt: asked.observedAt,
        periodStart,
      }),
    )
    .find((code) => code !== undefined);
  if (invalid !== undefined) {
    return yield* fail(invalid);
  }
  if (yield* hasDuplicateRows(usageRows)) {
    return yield* fail("billing_duplicate_record");
  }
  const snapshot: UsageSnapshot = {
    measuredThrough: DateTime.formatIso(
      DateTime.makeUnsafe(yield* latestChargeEnd({ observedAt: asked.observedAt, usageRows })),
    ),
    periodStart,
    records: usageRows.length,
    usageUsd: yield* totalCost(usageRows),
  };
  return snapshot;
});

const httpFailed = (): BudgetFailure => new BudgetFailure({ code: "billing_http_failed" });

const fetchUsage = Effect.fn("fetchUsage")(function* fetchUsage(asked: {
  readonly accountId: string;
  readonly observedAt: number;
  readonly token: string;
}) {
  if (!isCloudflareId(asked.accountId)) {
    return yield* fail("billing_account_invalid");
  }
  const billingResponse = yield* HttpClient.get(billableUsageEndpoint(asked.accountId), {
    headers: { Accept: "application/json", Authorization: `Bearer ${asked.token}` },
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.mapError(httpFailed));
  if (billingResponse.status < 200 || billingResponse.status >= 300) {
    return yield* fail("billing_http_failed");
  }
  const billingPayload = yield* HttpClientResponse.schemaBodyJson(Schema.Unknown)(
    billingResponse,
  ).pipe(Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })));
  return yield* summarizeUsage({
    accountId: asked.accountId,
    observedAt: asked.observedAt,
    payload: billingPayload,
  });
});

export { fetchUsage };
export type { UsageSnapshot };
