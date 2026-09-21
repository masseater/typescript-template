import { CloudflareId } from "@repo/config";
import { Effect, Schema } from "effect";

import { BudgetFailure, fail } from "./config.ts";

const MILLISECONDS_PER_HOUR = 3_600_000;
const FUTURE_CHARGE_TOLERANCE_HOURS = 24;
const MAX_DATA_AGE_HOURS = 48;
const isCloudflareAccountId = Schema.is(CloudflareId);
const BILLING_REQUEST_TIMEOUT_MS = 15_000;

const ChargeTimestamp = Schema.String.check(
  Schema.makeFilter(
    (candidate: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(candidate) &&
      !Number.isNaN(Date.parse(candidate)),
  ),
);
const BilledCost = Schema.Number.pipe(
  Schema.check(Schema.isFinite()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);
const OptionalIdentifier = Schema.optionalKey(Schema.NullOr(Schema.String));
const UsageRow = Schema.Struct({
  BilledCost,
  BillingAccountId: Schema.String,
  BillingCurrency: Schema.Literal("USD"),
  BillingPeriodStart: ChargeTimestamp,
  ChargeCategory: Schema.Literal("Usage"),
  ChargePeriodEnd: ChargeTimestamp,
  ChargePeriodStart: ChargeTimestamp,
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

type UsageRecord = typeof UsageRow.Type;

const billingPeriodStart = (
  usageRows: readonly UsageRecord[],
): Effect.Effect<string, BudgetFailure> => {
  const periodStarts = new Set(usageRows.map((usageRow) => usageRow.BillingPeriodStart));
  const [periodStart] = periodStarts;
  return periodStarts.size === 1 && periodStart !== undefined
    ? Effect.succeed(periodStart)
    : fail("billing_period_ambiguous");
};

const rowFailure = (asked: {
  readonly usageRow: UsageRecord;
  readonly accountId: string;
  readonly periodStart: string;
  readonly observedAt: Readonly<Date>;
}): BudgetFailure["code"] | undefined => {
  if (asked.usageRow.BillingAccountId !== asked.accountId) {
    return "billing_account_mismatch";
  }
  const chargeStart = Date.parse(asked.usageRow.ChargePeriodStart);
  const chargeEnd = Date.parse(asked.usageRow.ChargePeriodEnd);
  const observedMs = asked.observedAt.getTime();
  const outOfPeriod =
    chargeStart < Date.parse(asked.periodStart) ||
    chargeEnd <= chargeStart ||
    chargeStart > observedMs ||
    chargeEnd > observedMs + FUTURE_CHARGE_TOLERANCE_HOURS * MILLISECONDS_PER_HOUR;
  return outOfPeriod ? "billing_dates_invalid" : undefined;
};

const hasDuplicateRows = (usageRows: readonly UsageRecord[]): boolean => {
  const rowFingerprints = new Set(
    usageRows.map((usageRow) =>
      JSON.stringify([
        usageRow.SubscriptionId,
        usageRow.ZoneId,
        usageRow.ServiceName,
        usageRow.ChargePeriodStart,
        usageRow.ChargePeriodEnd,
      ]),
    ),
  );
  return rowFingerprints.size !== usageRows.length;
};

const latestChargeEnd = (asked: {
  readonly usageRows: readonly UsageRecord[];
  readonly observedAt: Readonly<Date>;
}): Effect.Effect<number, BudgetFailure> => {
  const latest = Math.max(
    ...asked.usageRows.map((usageRow) => Date.parse(usageRow.ChargePeriodEnd)),
  );
  return asked.observedAt.getTime() - latest > MAX_DATA_AGE_HOURS * MILLISECONDS_PER_HOUR
    ? fail("billing_data_stale")
    : Effect.succeed(latest);
};

const totalCost = (usageRows: readonly UsageRecord[]): Effect.Effect<number, BudgetFailure> => {
  const usageUsd = usageRows.reduce((running, usageRow) => running + usageRow.BilledCost, 0);
  return Number.isFinite(usageUsd) ? Effect.succeed(usageUsd) : fail("billing_cost_invalid");
};

const summarizeUsage = Effect.fn("summarizeUsage")(function* summarizeUsage(asked: {
  readonly input: unknown;
  readonly accountId: string;
  readonly observedAt: Readonly<Date>;
}) {
  const { result: usageRows } = yield* Schema.decodeUnknownEffect(UsageEnvelope)(asked.input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })),
  );
  const periodStart = yield* billingPeriodStart(usageRows);
  const invalid = usageRows
    .map((usageRow) =>
      rowFailure({
        accountId: asked.accountId,
        observedAt: asked.observedAt,
        periodStart,
        usageRow,
      }),
    )
    .find((code) => code !== undefined);
  if (invalid !== undefined) {
    return yield* fail(invalid);
  }
  if (hasDuplicateRows(usageRows)) {
    return yield* fail("billing_duplicate_record");
  }
  const snapshot: UsageSnapshot = {
    measuredThrough: new Date(
      yield* latestChargeEnd({ observedAt: asked.observedAt, usageRows }),
    ).toISOString(),
    periodStart,
    records: usageRows.length,
    usageUsd: yield* totalCost(usageRows),
  };
  return snapshot;
});

const httpFailed = (): BudgetFailure => new BudgetFailure({ code: "billing_http_failed" });

const fetchUsage = Effect.fn("fetchUsage")(function* fetchUsage(asked: {
  readonly accountId: string;
  readonly token: string;
  readonly observedAt: Readonly<Date>;
  readonly usageEndpoint: string;
}) {
  if (!isCloudflareAccountId(asked.accountId)) {
    return yield* fail("billing_account_invalid");
  }
  const billingResponse = yield* Effect.tryPromise({
    catch: httpFailed,
    try: async (signal) =>
      fetch(asked.usageEndpoint, {
        headers: { Accept: "application/json", Authorization: `Bearer ${asked.token}` },
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(BILLING_REQUEST_TIMEOUT_MS)]),
      }),
  });
  if (!billingResponse.ok) {
    return yield* fail("billing_http_failed");
  }
  const billingPayload = yield* Effect.tryPromise({
    catch: () => new BudgetFailure({ code: "billing_response_invalid" }),
    try: async (): Promise<unknown> => billingResponse.json(),
  });
  return yield* summarizeUsage({
    accountId: asked.accountId,
    input: billingPayload,
    observedAt: asked.observedAt,
  });
});

const billableUsageEndpoint = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`;

export { billableUsageEndpoint, fetchUsage };
export type { UsageSnapshot };
