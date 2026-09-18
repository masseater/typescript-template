import type { WorkerObservability } from "alchemy/Cloudflare";
import { Config, Effect, Schema } from "effect";

import { workerCompatibility } from "@repo/config/worker";

import type { StackName } from "./stacks.ts";
import { stackNames } from "./stacks.ts";

class CloudflareFailure extends Schema.TaggedError<CloudflareFailure>()("CloudflareFailure", {
  code: Schema.Literals([
    "deployment_command_invalid",
    "account_read_unavailable",
    "app_origins_must_differ",
    "budget_has_no_usage_allowance",
    "database_input_invalid",
    "database_name_taken",
    "database_output_unavailable",
    "deploy_token_permissions_missing",
    "plan_adopts_existing_resources",
    "plan_confirmation_mismatch",
    "plan_removes_bindings",
    "plan_removes_resources",
    "secrets_store_already_present",
    "state_store_name_taken",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

function fail(
  code: CloudflareFailure["code"],
  keys: readonly string[] = [],
): Effect.Effect<never, CloudflareFailure> {
  return Effect.fail(new CloudflareFailure({ code, keys }));
}

const MAX_BUDGET_RECIPIENTS = 10;
const MIN_AUTH_SECRET_LENGTH = 32;
const MIN_AUTH_SECRET_VARIETY = 16;
const CONFIRMATION_LENGTH = 16;
const CONFIRMATION_PATTERN = new RegExp(`^[0-9a-f]{${CONFIRMATION_LENGTH}}$`, "u");

const Id = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u));
const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));
const Nonnegative = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));
const Prefix = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{2,35}$/u));
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
const Recipients = Config.Array(Email).check(Schema.isLengthBetween(1, MAX_BUDGET_RECIPIENTS));
const SamplingRate = Schema.Number.check(
  Schema.isFinite(),
  Schema.isBetween({ maximum: 1, minimum: 0 }),
);
const AuthSecret = Schema.String.check(
  Schema.isMinLength(MIN_AUTH_SECRET_LENGTH),
  Schema.makeFilter((value: string) => value.trim() === value),
  Schema.makeFilter((value: string) => new Set(value).size >= MIN_AUTH_SECRET_VARIETY),
);

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
  observabilitySampling: SamplingRate,
  origins: Schema.Struct({ admin: Origin, user: Origin, wiki: Origin }),
  prefix: Prefix,
  zoneId: Id,
});

type SharedConfig = typeof SharedSettings.Type;

const originKeys = {
  admin: "TEMPLATE_ADMIN_ORIGIN",
  user: "TEMPLATE_USER_ORIGIN",
  wiki: "TEMPLATE_WIKI_ORIGIN",
} as const;

const workerSubdomain = { enabled: false, previewsEnabled: false };
const workerCompatibilityOptions = {
  date: workerCompatibility.date,
  flags: [...workerCompatibility.flags],
};
function workerObservability(headSamplingRate: number): WorkerObservability {
  return {
    enabled: true,
    headSamplingRate,
    logs: { enabled: true, headSamplingRate, invocationLogs: false },
    traces: { enabled: true, headSamplingRate },
  };
}

const PlanCommand = Schema.Tuple([Schema.Literal("plan"), Schema.Literals(["all", ...stackNames])]);
const DeployCommand = Schema.Tuple([
  Schema.Literal("deploy"),
  Schema.Literals(stackNames),
  Schema.Literal("--confirm-plan"),
  Schema.String.check(Schema.isPattern(CONFIRMATION_PATTERN)),
]);
const DeploymentCommand = Schema.Union([PlanCommand, DeployCommand]);

const parseDeploymentCommand = Effect.fn("parseDeploymentCommand")(function* parseDeploymentCommand(
  args: readonly string[],
) {
  const parsed = yield* Schema.decodeUnknownEffect(DeploymentCommand)(args).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "deployment_command_invalid", keys: [] })),
  );
  if (parsed[0] === "deploy") {
    return { confirmation: parsed[3], operation: "deploy", stack: parsed[1] } as const;
  }
  const [, target] = parsed;
  const stacks: readonly StackName[] = stackNames.filter(
    (stack) => target === "all" || stack === target,
  );
  return { operation: "plan", stacks } as const;
});

function duplicatedOrigins(config: SharedConfig): readonly string[] {
  const origins = [
    [originKeys.admin, config.origins.admin],
    [originKeys.user, config.origins.user],
    [originKeys.wiki, config.origins.wiki],
  ] as const;
  return origins.flatMap(([key, origin]) =>
    origins.some(([other, value]) => other !== key && value === origin) ? [key] : [],
  );
}

const checkSharedConfig = Effect.fn("checkSharedConfig")(function* checkSharedConfig(
  config: SharedConfig,
) {
  const duplicated = duplicatedOrigins(config);
  if (duplicated.length > 0) {
    return yield* fail("app_origins_must_differ", duplicated);
  }
  if (
    config.budget.budgetJpy / config.budget.jpyPerUsd <=
    config.budget.fixedCostUsd + config.budget.reserveUsd
  ) {
    return yield* fail("budget_has_no_usage_allowance", [
      "BUDGET_JPY",
      "TEMPLATE_FIXED_COST_USD",
      "TEMPLATE_RESERVE_USD",
    ]);
  }
  return config;
});

type DeploymentRequest = Effect.Success<ReturnType<typeof parseDeploymentCommand>>;
type DeploymentTarget = Pick<SharedConfig, "accountId" | "prefix">;

export {
  AuthSecret,
  CONFIRMATION_LENGTH,
  SamplingRate,
  CloudflareFailure,
  Email,
  Id,
  Nonnegative,
  Origin,
  Positive,
  Prefix,
  Recipients,
  SharedSettings,
  checkSharedConfig,
  originKeys,
  parseDeploymentCommand,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
};
export type { DeploymentRequest, DeploymentTarget, SharedConfig };
