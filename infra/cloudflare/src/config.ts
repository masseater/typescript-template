import { Effect, Schema } from "effect";
import { applyPlan, stackNames } from "./stacks.ts";

class CloudflareFailure extends Schema.TaggedError<CloudflareFailure>()("CloudflareFailure", {
  code: Schema.Literals([
    "deployment_command_invalid",
    "cloudflare_settings_invalid",
    "app_origins_must_differ",
    "budget_has_no_usage_allowance",
    "auth_secret_invalid",
    "account_permission_unavailable",
    "database_input_invalid",
    "stack_consumer_mismatch",
    "stack_output_invalid",
  ]),
}) {}

function fail(code: CloudflareFailure["code"]): Effect.Effect<never, CloudflareFailure> {
  return Effect.fail(new CloudflareFailure({ code }));
}

const MAX_BUDGET_RECIPIENTS = 10;
const MIN_AUTH_SECRET_LENGTH = 32;

const Id = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u));
const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));
const Nonnegative = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));
const Origin = Schema.String.check(
  Schema.makeFilter((value: string) => URL.canParse(value)),
  Schema.makeFilter((value: string) => {
    const url = URL.parse(value);
    return (
      url?.protocol === "https:" &&
      url.origin === value &&
      !url.hostname.endsWith(".workers.dev") &&
      !url.username &&
      !url.password
    );
  }),
);

const Recipients = Schema.Array(Email).check(Schema.isLengthBetween(1, MAX_BUDGET_RECIPIENTS));

const SharedSettings = Schema.Struct({
  accountId: Id,
  budget: Schema.Struct({
    budgetJpy: Positive,
    fixedCostUsd: Nonnegative,
    jpyPerUsd: Positive,
    recipients: Recipients,
    reserveUsd: Nonnegative,
  }),
  mailFrom: Email,
  origins: Schema.Struct({ admin: Origin, user: Origin, wiki: Origin }),
  prefix: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{2,35}$/u)),
  zoneId: Id,
});

type SharedConfig = typeof SharedSettings.Type;

const workerSubdomain = { enabled: false, previewsEnabled: false };

const DeploymentCommand = Schema.Tuple([
  Schema.Literals(["preview", "up"]),
  Schema.Literals(["all", ...stackNames]),
]);

const parseDeploymentCommand = Effect.fn("parseDeploymentCommand")(function* parseDeploymentCommand(
  args: readonly string[],
) {
  const [operation, target] = yield* Schema.decodeUnknownEffect(DeploymentCommand)(args).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "deployment_command_invalid" })),
  );
  const plan = yield* applyPlan();
  return {
    operation,
    targets: target === "all" ? plan : plan.filter(({ stack }) => stack === target),
  };
});

const parseSharedConfig = Effect.fn("parseSharedConfig")(function* parseSharedConfig(
  input: unknown,
) {
  const config = yield* Schema.decodeUnknownEffect(SharedSettings)(input).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "cloudflare_settings_invalid" })),
  );
  const origins = Object.values(config.origins);
  if (new Set(origins).size !== origins.length) {
    return yield* fail("app_origins_must_differ");
  }
  if (
    config.budget.budgetJpy / config.budget.jpyPerUsd <=
    config.budget.fixedCostUsd + config.budget.reserveUsd
  ) {
    return yield* fail("budget_has_no_usage_allowance");
  }
  return config;
});

const validateAuthSecret = Effect.fn("validateAuthSecret")(function* validateAuthSecret(
  secret: unknown,
) {
  if (
    typeof secret !== "string" ||
    secret.length < MIN_AUTH_SECRET_LENGTH ||
    secret.trim() !== secret
  ) {
    return yield* fail("auth_secret_invalid");
  }
  return secret;
});

const selectAccountPermission = Effect.fn("selectAccountPermission")(
  function* selectAccountPermission(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    groups: readonly { id: string; name: string; scopes: string[] }[],
    name: "Billing Read" | "Workers Observability Write",
  ) {
    const matches = groups.filter(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (group) => group.name === name && group.scopes.includes("com.cloudflare.api.account"),
    );
    if (matches.length !== 1) {
      return yield* fail("account_permission_unavailable");
    }
    return yield* Schema.decodeUnknownEffect(Id)(matches[0]?.id).pipe(
      Effect.mapError(() => new CloudflareFailure({ code: "account_permission_unavailable" })),
    );
  },
);

export {
  CloudflareFailure,
  parseDeploymentCommand,
  parseSharedConfig,
  selectAccountPermission,
  validateAuthSecret,
  workerSubdomain,
};
export type { SharedConfig };
