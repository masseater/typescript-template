import * as v from "valibot";

const positive = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));
const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const decimal = v.pipe(v.string(), v.regex(/^\d+(?:\.\d+)?$/), v.transform(Number));
const schema = v.object({
  CLOUDFLARE_ACCOUNT_ID: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
  BILLING_READ_TOKEN: v.pipe(v.string(), v.minLength(20)),
  BUDGET_JPY: v.pipe(decimal, positive),
  JPY_PER_USD: v.pipe(decimal, positive),
  FIXED_COST_USD: v.pipe(decimal, nonnegative),
  RESERVE_USD: v.pipe(decimal, nonnegative),
});

export type BudgetConfig = v.InferOutput<typeof schema>;

export function parseBudgetConfig(input: unknown): BudgetConfig {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new Error("budget_config_invalid");
  if (
    result.output.BUDGET_JPY / result.output.JPY_PER_USD <=
    result.output.FIXED_COST_USD + result.output.RESERVE_USD
  ) {
    throw new Error("budget_has_no_usage_allowance");
  }
  return result.output;
}
