import {
  array,
  finite,
  isoTimestamp,
  literal,
  looseObject,
  minLength,
  minValue,
  nullable,
  number,
  object,
  optional,
  pipe,
  safeParse,
  string,
} from "valibot";
import type { InferOutput } from "valibot";

const MILLISECONDS_PER_HOUR = 3_600_000;
const FUTURE_CHARGE_TOLERANCE_HOURS = 24;
const MAX_DATA_AGE_HOURS = 48;
const REQUEST_TIMEOUT_MS = 15_000;

const timestamp = pipe(string(), isoTimestamp());
const cost = pipe(number(), finite(), minValue(0));
const optionalIdentifier = optional(nullable(string()));
const row = looseObject({
  BilledCost: cost,
  BillingAccountId: string(),
  BillingCurrency: literal("USD"),
  BillingPeriodStart: timestamp,
  ChargeCategory: literal("Usage"),
  ChargePeriodEnd: timestamp,
  ChargePeriodStart: timestamp,
  ServiceName: pipe(string(), minLength(1)),
  SubscriptionId: optionalIdentifier,
  ZoneId: optionalIdentifier,
});
const envelope = object({
  result: pipe(array(row), minLength(1)),
  success: literal(true),
});

type UsageRow = Readonly<InferOutput<typeof row>>;

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

function parseRows(input: unknown): readonly UsageRow[] {
  const parsed = safeParse(envelope, input);
  if (!parsed.success) {
    throw new Error("billing_response_invalid");
  }
  return parsed.output.result;
}

function billingPeriodStart(rows: readonly UsageRow[]): string {
  const starts = new Set(rows.map((item) => item.BillingPeriodStart));
  const [periodStart] = starts;
  if (starts.size !== 1 || periodStart === undefined) {
    throw new Error("billing_period_ambiguous");
  }
  return periodStart;
}

function assertRowInPeriod(item: UsageRow, expectation: Readonly<RowExpectation>): void {
  if (item.BillingAccountId !== expectation.accountId) {
    throw new Error("billing_account_mismatch");
  }
  const start = Date.parse(item.ChargePeriodStart);
  const end = Date.parse(item.ChargePeriodEnd);
  const now = expectation.now.getTime();
  if (
    start < Date.parse(expectation.periodStart) ||
    end <= start ||
    start > now ||
    end > now + FUTURE_CHARGE_TOLERANCE_HOURS * MILLISECONDS_PER_HOUR
  ) {
    throw new Error("billing_dates_invalid");
  }
}

function assertNoDuplicateRows(rows: readonly UsageRow[]): void {
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
  if (keys.size !== rows.length) {
    throw new Error("billing_duplicate_record");
  }
}

function latestChargeEnd(rows: readonly UsageRow[], now: Readonly<Date>): number {
  const latest = Math.max(...rows.map((item) => Date.parse(item.ChargePeriodEnd)));
  if (now.getTime() - latest > MAX_DATA_AGE_HOURS * MILLISECONDS_PER_HOUR) {
    throw new Error("billing_data_stale");
  }
  return latest;
}

function totalCost(rows: readonly UsageRow[]): number {
  const total = rows.reduce((sum, item) => sum + item.BilledCost, 0);
  if (!Number.isFinite(total)) {
    throw new RangeError("billing_cost_invalid");
  }
  return total;
}

function parseUsageResponse(input: unknown, accountId: string, now: Readonly<Date>): UsageSnapshot {
  const rows = parseRows(input);
  const periodStart = billingPeriodStart(rows);
  for (const item of rows) {
    assertRowInPeriod(item, { accountId, now, periodStart });
  }
  assertNoDuplicateRows(rows);
  return {
    measuredThrough: new Date(latestChargeEnd(rows, now)).toISOString(),
    periodStart,
    records: rows.length,
    usageUsd: totalCost(rows),
  };
}

async function fetchUsage(
  accountId: string,
  token: string,
  now: Readonly<Date>,
): Promise<UsageSnapshot> {
  if (!/^[a-f0-9]{32}$/u.test(accountId)) {
    throw new Error("billing_account_invalid");
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error("billing_http_failed");
  }
  const body: unknown = await response.json();
  return parseUsageResponse(body, accountId, now);
}

export { fetchUsage };
export type { UsageSnapshot };
