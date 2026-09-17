import { Effect, Schema, SchemaGetter, SchemaTransformation } from "effect";

export class BudgetFailure extends Schema.TaggedError<BudgetFailure>()("BudgetFailure", {
  code: Schema.Literals([
    "budget_config_invalid",
    "budget_has_no_usage_allowance",
    "budget_input_invalid",
    "billing_account_invalid",
    "billing_http_failed",
    "billing_response_invalid",
    "billing_period_ambiguous",
    "billing_account_mismatch",
    "billing_dates_invalid",
    "billing_duplicate_record",
    "billing_data_stale",
    "billing_cost_invalid",
  ]),
}) {}

export const fail = (code: BudgetFailure["code"]) => Effect.fail(new BudgetFailure({ code }));

const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
const Decimal = Schema.String.check(Schema.isPattern(/^\d+(?:\.\d+)?$/)).pipe(
  Schema.decodeTo(Schema.Number.check(Schema.isFinite()), SchemaTransformation.numberFromString),
);
const Recipients = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Email).check(Schema.isLengthBetween(1, 10)), {
    decode: SchemaGetter.transform((value: string) => value.split(",")),
    encode: SchemaGetter.transform((value: readonly string[]) => value.join(",")),
  }),
);

const BudgetEnvironment = Schema.Struct({
  CLOUDFLARE_ACCOUNT_ID: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/)),
  BILLING_READ_TOKEN: Schema.String.check(Schema.isMinLength(20)),
  BUDGET_JPY: Decimal.check(Schema.isGreaterThan(0)),
  JPY_PER_USD: Decimal.check(Schema.isGreaterThan(0)),
  FIXED_COST_USD: Decimal,
  RESERVE_USD: Decimal,
  ALERT_FROM: Email,
  ALERT_TO: Recipients,
});

export type BudgetConfig = typeof BudgetEnvironment.Type;

export const parseBudgetConfig = Effect.fn("parseBudgetConfig")(function* (input: unknown) {
  const config = yield* Schema.decodeUnknownEffect(BudgetEnvironment)(input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "budget_config_invalid" })),
  );
  if (config.BUDGET_JPY / config.JPY_PER_USD <= config.FIXED_COST_USD + config.RESERVE_USD)
    return yield* fail("budget_has_no_usage_allowance");
  return config;
});
