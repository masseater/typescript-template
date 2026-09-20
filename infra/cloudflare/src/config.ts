import {
  CloudflareId,
  Email,
  GoogleAnalyticsMeasurementId,
  HttpsOrigin,
  ROLE,
  distinctOrigins,
  minimumAuthSecretLength,
  usageAllowanceRemains,
} from "@repo/config";
import { workerCompatibility } from "@repo/config/worker";
import { maximumAlertRecipients } from "@repo/monitor";
import { otlpSignalUrl } from "@repo/observability";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { hstsIncludesSubdomains, hstsMaxAgeSeconds } from "@repo/runtime/security";
import { Config, Effect, Schema } from "effect";

import { stackNames } from "./stacks.ts";

import type { WorkerObservability } from "alchemy/Cloudflare";
import type { StackName } from "./stacks.ts";

class CloudflareFailure extends Schema.TaggedError<CloudflareFailure>()("CloudflareFailure", {
  code: Schema.Literals([
    "deployment_command_invalid",
    "account_read_unavailable",
    "budget_has_no_usage_allowance",
    "database_input_invalid",
    "database_migration_history_missing",
    "database_migration_status_unreadable",
    "database_migrations_pending",
    "database_name_taken",
    "database_output_unavailable",
    "deploy_token_permissions_missing",
    "mail_from_outside_deployment",
    "otlp_enabled_without_endpoint",
    "origins_must_differ",
    "plan_adopts_existing_resources",
    "plan_confirmation_mismatch",
    "plan_removes_bindings",
    "plan_removes_resources",
    "secrets_store_already_present",
    "sending_domain_unavailable",
    "state_store_name_taken",
    "trace_destination_not_applied",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

function fail(
  code: CloudflareFailure["code"],
  keys: readonly string[] = [],
): Effect.Effect<never, CloudflareFailure> {
  return Effect.fail(new CloudflareFailure({ code, keys }));
}

const MIN_AUTH_SECRET_VARIETY = 16;
const CONFIRMATION_LENGTH = 16;
const CONFIRMATION_PATTERN = new RegExp(`^[0-9a-f]{${CONFIRMATION_LENGTH}}$`, "u");

const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));
const Nonnegative = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const Prefix = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{2,35}$/u));
const Origin = HttpsOrigin.check(
  Schema.makeFilter((value: string) => {
    const url = URL.parse(value);
    return url !== null && !url.hostname.endsWith(".workers.dev");
  }),
);
const Domain = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      URL.parse(`https://${value}`)?.hostname === value &&
      value.includes(".") &&
      !value.endsWith(".workers.dev"),
  ),
);
const HttpsUrl = Schema.String.check(
  Schema.makeFilter((value: string) => URL.parse(value)?.protocol === "https:"),
);
const Recipients = Config.Array(Email).check(Schema.isLengthBetween(1, maximumAlertRecipients));
const SamplingRate = Schema.Number.check(
  Schema.isFinite(),
  Schema.isBetween({ maximum: 1, minimum: 0 }),
);
const AuthSecret = Schema.String.check(
  Schema.isMinLength(minimumAuthSecretLength),
  Schema.makeFilter((value: string) => value.trim() === value),
  Schema.makeFilter((value: string) => new Set(value).size >= MIN_AUTH_SECRET_VARIETY),
);

const SharedSettings = Schema.Struct({
  accountId: CloudflareId,
  budget: Schema.Struct({
    budgetJpy: Positive,
    fixedCostUsd: Nonnegative,
    jpyPerUsd: Positive,
    recipients: Recipients,
    reserveUsd: Nonnegative,
  }),
  googleAnalyticsMeasurementId: Schema.optional(GoogleAnalyticsMeasurementId),
  mailFrom: Email,
  observabilitySampling: SamplingRate,
  origins: Schema.Struct({
    "internal-dashboard": Origin,
    "service-admin": Origin,
    "service-member": Origin,
  }),
  otlp: Schema.UndefinedOr(Schema.Struct({ enabled: Schema.Boolean, endpoint: HttpsUrl })),
  prefix: Prefix,
  zoneId: CloudflareId,
});

type SharedConfig = typeof SharedSettings.Type;

const checkOtlpSettings = Effect.fn("checkOtlpSettings")(function* checkOtlpSettings(
  otlp: Readonly<{ enabled: boolean | undefined; endpoint: string | undefined }>,
) {
  if (otlp.endpoint === undefined && otlp.enabled !== undefined) {
    return yield* fail("otlp_enabled_without_endpoint", [
      deploymentKey.otlpEnabled,
      deploymentKey.otlpEndpoint,
    ]);
  }
  return otlp.endpoint === undefined
    ? undefined
    : { enabled: otlp.enabled ?? true, endpoint: otlp.endpoint };
});

function deriveOrigins(prefix: string, appDomain: string): SharedConfig["origins"] {
  const origin = (label: string): string => `https://${prefix}-${label}.${appDomain}`;
  return {
    "internal-dashboard": origin("dashboard"),
    "service-admin": origin(ROLE.administrator),
    "service-member": origin(ROLE.member),
  };
}

const hstsSetting = {
  strict_transport_security: {
    enabled: true,
    include_subdomains: hstsIncludesSubdomains,
    max_age: hstsMaxAgeSeconds,
    nosniff: true,
    preload: false,
  },
} as const;

const workerSubdomain = { enabled: false, previewsEnabled: false };
const workerCompatibilityOptions = {
  date: workerCompatibility.date,
  flags: [...workerCompatibility.flags],
};
interface TraceDestination {
  readonly enabled: boolean;
  readonly name: string;
  readonly url: string;
}

function traceDestination(config: SharedConfig): TraceDestination | undefined {
  return config.otlp === undefined
    ? undefined
    : {
        enabled: config.otlp.enabled,
        name: `${config.prefix}-traces`,
        url: otlpSignalUrl(config.otlp.endpoint, "traces"),
      };
}

function workerObservability(config: SharedConfig): WorkerObservability {
  const headSamplingRate = config.observabilitySampling;
  const destination = traceDestination(config);
  return {
    enabled: true,
    headSamplingRate,
    logs: { enabled: true, headSamplingRate, invocationLogs: false },
    traces: {
      enabled: true,
      headSamplingRate,
      ...(destination === undefined ? {} : { destinations: [destination.name], persist: true }),
    },
  };
}

const PlanCommand = Schema.Tuple([Schema.Literal("plan"), Schema.Literals(["all", ...stackNames])]);
const DeployAllCommand = Schema.Tuple([Schema.Literal("deploy"), Schema.Literal("all")]);
const DeployCommand = Schema.Tuple([
  Schema.Literal("deploy"),
  Schema.Literals(stackNames),
  Schema.Literal("--confirm-plan"),
  Schema.String.check(Schema.isPattern(CONFIRMATION_PATTERN)),
]);
const DeploymentCommand = Schema.Union([PlanCommand, DeployAllCommand, DeployCommand]);

const parseDeploymentCommand = Effect.fn("parseDeploymentCommand")(function* parseDeploymentCommand(
  args: readonly string[],
) {
  const parsed = yield* Schema.decodeUnknownEffect(DeploymentCommand)(args).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "deployment_command_invalid", keys: [] })),
  );
  if (parsed[0] === "deploy" && parsed[1] === "all") {
    return { operation: "deploy-all", stacks: stackNames } as const;
  }
  if (parsed[0] === "deploy") {
    return { confirmation: parsed[3], operation: "deploy", stack: parsed[1] } as const;
  }
  const [, target] = parsed;
  const stacks: readonly StackName[] = stackNames.filter(
    (stack) => target === "all" || stack === target,
  );
  return { operation: "plan", stacks } as const;
});

function sendingDomain(mailFrom: string): string {
  return mailFrom.slice(mailFrom.indexOf("@") + 1);
}

const checkSharedConfig = Effect.fn("checkSharedConfig")(function* checkSharedConfig(
  config: SharedConfig,
) {
  if (!usageAllowanceRemains(config.budget)) {
    return yield* fail("budget_has_no_usage_allowance", [
      deploymentKey.budgetJpy,
      deploymentKey.fixedCostUsd,
      deploymentKey.reserveUsd,
    ]);
  }
  if (!distinctOrigins(Object.values(config.origins))) {
    return yield* fail("origins_must_differ", [deploymentKey.appDomain, deploymentKey.prefix]);
  }
  if (!sendingDomain(config.mailFrom).startsWith(`${config.prefix}.`)) {
    return yield* fail("mail_from_outside_deployment", [
      deploymentKey.mailFrom,
      deploymentKey.prefix,
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
  Domain,
  Email,
  HttpsUrl,
  CloudflareId,
  Nonnegative,
  Origin,
  Positive,
  Prefix,
  Recipients,
  SharedSettings,
  checkOtlpSettings,
  checkSharedConfig,
  deriveOrigins,
  hstsSetting,
  parseDeploymentCommand,
  sendingDomain,
  traceDestination,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
};
export type { DeploymentRequest, DeploymentTarget, SharedConfig };
