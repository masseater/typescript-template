import { CloudflareApiToken, CloudflareId, usageAllowanceRemains } from "@repo/config";
import { budgetMonitorEnv, budgetMonitorWorker } from "@repo/monitor/workers";
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

const fail = (failureCode: BudgetFailure["code"]): Effect.Effect<never, BudgetFailure> =>
  Effect.fail(new BudgetFailure({ code: failureCode }));

const DecimalText = Schema.String.check(Schema.isPattern(/^\d+(?:\.\d+)?$/u));
const FiniteNumber = Schema.Number.check(Schema.isFinite());
const Decimal = DecimalText.pipe(
  Schema.decodeTo(FiniteNumber, SchemaTransformation.numberFromString),
);

const BudgetEnvironment = Schema.Struct({
  [budgetMonitorEnv.billingReadToken]: CloudflareApiToken,
  [budgetMonitorEnv.budgetJpy]: Decimal.check(Schema.isGreaterThan(0)),
  [budgetMonitorEnv.accountId]: CloudflareId,
  [budgetMonitorEnv.fixedCostUsd]: Decimal,
  [budgetMonitorEnv.jpyPerUsd]: Decimal.check(Schema.isGreaterThan(0)),
  [budgetMonitorEnv.reserveUsd]: Decimal,
});

type BudgetConfig = typeof BudgetEnvironment.Type;
type BudgetMonitorEnv = typeof BudgetEnvironment.Encoded;

const parseBudgetConfig = Effect.fn("parseBudgetConfig")(function* parseBudgetConfig(
  input: unknown,
) {
  const config = yield* Schema.decodeUnknownEffect(BudgetEnvironment)(input).pipe(
    Effect.mapError(() => new BudgetFailure({ code: "budget_config_invalid" })),
  );
  if (
    !usageAllowanceRemains({
      budgetJpy: config[budgetMonitorEnv.budgetJpy],
      fixedCostUsd: config[budgetMonitorEnv.fixedCostUsd],
      jpyPerUsd: config[budgetMonitorEnv.jpyPerUsd],
      reserveUsd: config[budgetMonitorEnv.reserveUsd],
    })
  ) {
    return yield* fail("budget_has_no_usage_allowance");
  }
  return config;
});

export { BudgetFailure, budgetMonitorWorker, fail, parseBudgetConfig };
export type { BudgetConfig, BudgetMonitorEnv };
