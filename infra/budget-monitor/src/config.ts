import { Effect, Schema, SchemaTransformation } from "effect";

class BudgetFailure extends Schema.TaggedError<BudgetFailure>()("BudgetFailure", {
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

const fail = (code: BudgetFailure["code"]): Effect.Effect<never, BudgetFailure> => {
  return Effect.fail(new BudgetFailure({ code }));
};

const MIN_BILLING_TOKEN_LENGTH = 20;

const DecimalText = Schema.String.check(Schema.isPattern(/^\d+(?:\.\d+)?$/u));
const FiniteNumber = Schema.Number.check(Schema.isFinite());
const Decimal = DecimalText.pipe(
  Schema.decodeTo(FiniteNumber, SchemaTransformation.numberFromString),
);

const BudgetEnvironment = Schema.Struct({
  BILLING_READ_TOKEN: Schema.String.check(Schema.isMinLength(MIN_BILLING_TOKEN_LENGTH)),
  BUDGET_JPY: Decimal.check(Schema.isGreaterThan(0)),
  CLOUDFLARE_ACCOUNT_ID: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u)),
  FIXED_COST_USD: Decimal,
  JPY_PER_USD: Decimal.check(Schema.isGreaterThan(0)),
  RESERVE_USD: Decimal,
});

type BudgetConfig = typeof BudgetEnvironment.Type;

const parseBudgetConfig = Effect.fn("parseBudgetConfig")(function* parseBudgetConfig(
  input: unknown,
) {
  const config = yield* Schema.decodeUnknownEffect(BudgetEnvironment)(input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "budget_config_invalid" })),
  );
  if (config.BUDGET_JPY / config.JPY_PER_USD <= config.FIXED_COST_USD + config.RESERVE_USD) {
    return yield* fail("budget_has_no_usage_allowance");
  }
  return config;
});

export { BudgetFailure, fail, parseBudgetConfig };
export type { BudgetConfig };
