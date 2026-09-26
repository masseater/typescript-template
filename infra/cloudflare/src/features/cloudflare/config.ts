import {
  CloudflareId,
  Email,
  GoogleAnalyticsMeasurementId,
  HttpsOrigin,
  ROLE,
  distinctOrigins,
} from "@repo/config";
import { workerCompatibility } from "@repo/config/worker";
import { Recipients } from "@repo/monitor";
import { otlpSignalUrl } from "@repo/observability";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { hstsIncludesSubdomains, hstsMaxAgeSeconds } from "@repo/runtime/security";
import { Effect, Schema } from "effect";

import { stackNames } from "./stacks.ts";

import type { WorkerObservability } from "alchemy/Cloudflare";
import type { StackName } from "./stacks.ts";

class CloudflareFailure extends Schema.TaggedError<CloudflareFailure>()("CloudflareFailure", {
  code: Schema.Literals([
    "deployment_command_invalid",
    "account_read_unavailable",
    "approval_handoff_unwritable",
    "database_input_invalid",
    "database_name_taken",
    "database_output_unavailable",
    "deploy_token_permissions_missing",
    "mail_from_outside_deployment",
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

const CONFIRMATION_LENGTH = 16;
const CONFIRMATION_PATTERN = new RegExp(`^[0-9a-f]{${CONFIRMATION_LENGTH}}$`, "u");
const Confirmation = Schema.String.check(Schema.isPattern(CONFIRMATION_PATTERN));

const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));
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
const observabilitySampling = 1;

const SharedSettings = Schema.Struct({
  accountId: CloudflareId,
  budget: Schema.Struct({
    budgetJpy: Positive,
    recipients: Recipients,
  }),
  googleAnalyticsMeasurementId: Schema.optional(GoogleAnalyticsMeasurementId),
  mailFrom: Email,
  origins: Schema.Struct({
    "internal-dashboard": Origin,
    "service-admin": Origin,
    "service-member": Origin,
  }),
  otlp: Schema.UndefinedOr(Schema.Struct({ endpoint: HttpsUrl })),
  prefix: Prefix,
  zoneId: CloudflareId,
});

type SharedConfig = typeof SharedSettings.Type;

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
  readonly name: string;
  readonly url: string;
}

function traceDestination(config: SharedConfig): TraceDestination | undefined {
  return config.otlp === undefined
    ? undefined
    : {
        name: `${config.prefix}-traces`,
        url: otlpSignalUrl(config.otlp.endpoint, "traces"),
      };
}

function workerObservability(config: SharedConfig): WorkerObservability {
  const headSamplingRate = observabilitySampling;
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
const DeployAllCommand = Schema.Union([
  Schema.Tuple([Schema.Literal("deploy"), Schema.Literal("all")]),
  Schema.Tuple([
    Schema.Literal("deploy"),
    Schema.Literal("all"),
    Schema.Literal("--approve"),
    Schema.Literals(stackNames),
    Confirmation,
  ]),
]);
const DeployCommand = Schema.Tuple([
  Schema.Literal("deploy"),
  Schema.Literals(stackNames),
  Schema.Literal("--confirm-plan"),
  Confirmation,
]);
const DeploymentCommand = Schema.Union([PlanCommand, DeployAllCommand, DeployCommand]);

const parseDeploymentCommand = Effect.fn("parseDeploymentCommand")(function* parseDeploymentCommand(
  args: readonly string[],
) {
  const parsed = yield* Schema.decodeUnknownEffect(DeploymentCommand)(args).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "deployment_command_invalid", keys: [] })),
  );
  if (parsed[0] === "deploy" && parsed[1] === "all") {
    const approval =
      parsed.length === 2 ? undefined : { confirmation: parsed[4], stack: parsed[3] };
    return { approval, operation: "deploy-all", stacks: stackNames } as const;
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
  CONFIRMATION_LENGTH,
  CloudflareFailure,
  Confirmation,
  Domain,
  Email,
  HttpsUrl,
  CloudflareId,
  Origin,
  Positive,
  Prefix,
  Recipients,
  SharedSettings,
  checkSharedConfig,
  deriveOrigins,
  hstsSetting,
  observabilitySampling,
  parseDeploymentCommand,
  sendingDomain,
  traceDestination,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
};
export type { DeploymentRequest, DeploymentTarget, SharedConfig, TraceDestination };
