import { Effect, Schema } from "effect";
import { BudgetFailure, fail } from "./config.ts";

const Timestamp = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      !Number.isNaN(Date.parse(value)),
  ),
);
const Cost = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const UsageRow = Schema.Struct({
  BillingAccountId: Schema.String,
  BillingCurrency: Schema.Literal("USD"),
  BillingPeriodStart: Timestamp,
  ChargePeriodStart: Timestamp,
  ChargePeriodEnd: Timestamp,
  ChargeCategory: Schema.Literal("Usage"),
  BilledCost: Cost,
  ServiceName: Schema.String.check(Schema.isMinLength(1)),
  SubscriptionId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  ZoneId: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
const UsageEnvelope = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Array(UsageRow).check(Schema.isMinLength(1)),
});

export interface UsageSnapshot {
  periodStart: string;
  measuredThrough: string;
  usageUsd: number;
  records: number;
}

const summarizeUsage = Effect.fn("summarizeUsage")(function* (
  input: unknown,
  accountId: string,
  now: Date,
) {
  const { result: rows } = yield* Schema.decodeUnknownEffect(UsageEnvelope)(input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "billing_response_invalid" })),
  );
  const [first] = rows;
  if (first === undefined) return yield* fail("billing_response_invalid");
  if (new Set(rows.map((item) => item.BillingPeriodStart)).size !== 1)
    return yield* fail("billing_period_ambiguous");
  const periodStart = first.BillingPeriodStart;
  const keys = new Set<string>();
  for (const item of rows) {
    if (item.BillingAccountId !== accountId) return yield* fail("billing_account_mismatch");
    const start = Date.parse(item.ChargePeriodStart);
    const end = Date.parse(item.ChargePeriodEnd);
    if (
      start < Date.parse(periodStart) ||
      end <= start ||
      start > now.getTime() ||
      end > now.getTime() + 86_400_000
    )
      return yield* fail("billing_dates_invalid");
    const key = JSON.stringify([
      item.SubscriptionId,
      item.ZoneId,
      item.ServiceName,
      item.ChargePeriodStart,
      item.ChargePeriodEnd,
    ]);
    if (keys.has(key)) return yield* fail("billing_duplicate_record");
    keys.add(key);
  }
  const latest = Math.max(...rows.map((item) => Date.parse(item.ChargePeriodEnd)));
  if (now.getTime() - latest > 48 * 60 * 60 * 1000) return yield* fail("billing_data_stale");
  const total = rows.reduce((sum, item) => sum + item.BilledCost, 0);
  if (!Number.isFinite(total)) return yield* fail("billing_cost_invalid");
  const snapshot: UsageSnapshot = {
    periodStart,
    measuredThrough: new Date(latest).toISOString(),
    usageUsd: total,
    records: rows.length,
  };
  return snapshot;
});

export const fetchUsage = Effect.fn("fetchUsage")(function* (
  accountId: string,
  token: string,
  now: Date,
) {
  if (!/^[a-f0-9]{32}$/.test(accountId)) return yield* fail("billing_account_invalid");
  const httpFailed = () => new BudgetFailure({ code: "billing_http_failed" });
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        redirect: "manual",
      }),
    catch: httpFailed,
  });
  if (!response.ok) return yield* fail("billing_http_failed");
  const body = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: () => new BudgetFailure({ code: "billing_response_invalid" }),
  });
  return yield* summarizeUsage(body, accountId, now);
});
