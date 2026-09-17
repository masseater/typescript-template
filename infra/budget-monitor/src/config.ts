import {
  array,
  email,
  finite,
  maxLength,
  minLength,
  minValue,
  number,
  object,
  pipe,
  regex,
  safeParse,
  string,
  transform,
} from "valibot";
import type { InferOutput } from "valibot";

const MAX_ALERT_RECIPIENTS = 10;
const MIN_BILLING_TOKEN_LENGTH = 20;

const positive = pipe(number(), finite(), minValue(Number.MIN_VALUE));
const nonnegative = pipe(number(), finite(), minValue(0));
const decimal = pipe(string(), regex(/^\d+(?:\.\d+)?$/u), transform(Number));
const emailAddress = pipe(string(), email());
const schema = object({
  ALERT_FROM: emailAddress,
  ALERT_TO: pipe(
    string(),
    transform((value) => value.split(",")),
    array(emailAddress),
    minLength(1),
    maxLength(MAX_ALERT_RECIPIENTS),
  ),
  BILLING_READ_TOKEN: pipe(string(), minLength(MIN_BILLING_TOKEN_LENGTH)),
  BUDGET_JPY: pipe(decimal, positive),
  CLOUDFLARE_ACCOUNT_ID: pipe(string(), regex(/^[a-f0-9]{32}$/u)),
  FIXED_COST_USD: pipe(decimal, nonnegative),
  JPY_PER_USD: pipe(decimal, positive),
  RESERVE_USD: pipe(decimal, nonnegative),
});

type BudgetConfig = InferOutput<typeof schema>;

function parseBudgetConfig(input: unknown): BudgetConfig {
  const result = safeParse(schema, input);
  if (!result.success) {
    throw new Error("budget_config_invalid");
  }
  if (
    result.output.BUDGET_JPY / result.output.JPY_PER_USD <=
    result.output.FIXED_COST_USD + result.output.RESERVE_USD
  ) {
    throw new Error("budget_has_no_usage_allowance");
  }
  return result.output;
}

export { parseBudgetConfig };
export type { BudgetConfig };
