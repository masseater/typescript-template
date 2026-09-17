import * as v from "valibot";

const timestamp = v.pipe(v.string(), v.isoTimestamp());
const cost = v.pipe(v.number(), v.finite(), v.minValue(0));
const row = v.looseObject({
  BillingAccountId: v.string(),
  BillingCurrency: v.literal("USD"),
  BillingPeriodStart: timestamp,
  ChargePeriodStart: timestamp,
  ChargePeriodEnd: timestamp,
  ChargeCategory: v.literal("Usage"),
  BilledCost: cost,
  ServiceName: v.pipe(v.string(), v.minLength(1)),
  SubscriptionId: v.optional(v.nullable(v.string())),
  ZoneId: v.optional(v.nullable(v.string())),
});
const envelope = v.object({
  success: v.literal(true),
  result: v.pipe(v.array(row), v.minLength(1)),
});

export interface UsageSnapshot {
  periodStart: string;
  measuredThrough: string;
  usageUsd: number;
  records: number;
}

function parseUsageResponse(input: unknown, accountId: string, now: Date): UsageSnapshot {
  const parsed = v.safeParse(envelope, input);
  if (!parsed.success) throw new Error("billing_response_invalid");
  const rows = parsed.output.result;
  const starts = new Set(rows.map((item) => item.BillingPeriodStart));
  if (starts.size !== 1) throw new Error("billing_period_ambiguous");
  const periodStart = rows[0]!.BillingPeriodStart;
  const keys = new Set<string>();
  for (const item of rows) {
    if (item.BillingAccountId !== accountId) throw new Error("billing_account_mismatch");
    const start = Date.parse(item.ChargePeriodStart);
    const end = Date.parse(item.ChargePeriodEnd);
    if (
      start < Date.parse(periodStart) ||
      end <= start ||
      start > now.getTime() ||
      end > now.getTime() + 86_400_000
    ) {
      throw new Error("billing_dates_invalid");
    }
    const key = JSON.stringify([
      item.SubscriptionId,
      item.ZoneId,
      item.ServiceName,
      item.ChargePeriodStart,
      item.ChargePeriodEnd,
    ]);
    if (keys.has(key)) throw new Error("billing_duplicate_record");
    keys.add(key);
  }
  const latest = Math.max(...rows.map((item) => Date.parse(item.ChargePeriodEnd)));
  if (now.getTime() - latest > 48 * 60 * 60 * 1000) throw new Error("billing_data_stale");
  const total = rows.reduce((sum, item) => sum + item.BilledCost, 0);
  if (!Number.isFinite(total)) throw new Error("billing_cost_invalid");
  return {
    periodStart,
    measuredThrough: new Date(latest).toISOString(),
    usageUsd: total,
    records: rows.length,
  };
}

export async function fetchUsage(
  accountId: string,
  token: string,
  now: Date,
): Promise<UsageSnapshot> {
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("billing_account_invalid");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    },
  );
  if (!response.ok) throw new Error("billing_http_failed");
  const body: unknown = await response.json();
  return parseUsageResponse(body, accountId, now);
}
