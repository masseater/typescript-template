import {
  array,
  check,
  email,
  finite,
  maxLength,
  minLength,
  minValue,
  number,
  object,
  optional,
  parse,
  pipe,
  readonly,
  record,
  regex,
  safeParse,
  string,
  url,
} from "valibot";
import type { InferOutput } from "valibot";
import { sentrySchemas } from "@template/config";

const MAX_ADMIN_EMAILS = 50;
const MAX_BUDGET_RECIPIENTS = 10;
const MIN_AUTH_SECRET_LENGTH = 32;
const DEPLOYMENT_COMMAND_LENGTH = 2;

const id = pipe(string(), regex(/^[a-f0-9]{32}$/u));
const positive = pipe(number(), finite(), minValue(Number.MIN_VALUE));
const nonnegative = pipe(number(), finite(), minValue(0));
const emailAddress = pipe(string(), email());
const origin = pipe(
  string(),
  url(),
  check((value) => {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.origin === value &&
      !parsed.hostname.endsWith(".workers.dev") &&
      !parsed.username &&
      !parsed.password
    );
  }),
);
const httpsUrl = pipe(
  string(),
  url(),
  check((value) => {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    );
  }),
);
const accessIssuer = pipe(
  origin,
  check((value) => new URL(value).hostname.endsWith(".cloudflareaccess.com")),
);
const sentryDsn = pipe(
  sentrySchemas.dsn,
  check((value) => new URL(value).protocol === "https:"),
);
const budgetSchema = object({
  budgetJpy: positive,
  fixedCostUsd: nonnegative,
  jpyPerUsd: positive,
  recipients: pipe(array(emailAddress), minLength(1), maxLength(MAX_BUDGET_RECIPIENTS), readonly()),
  reserveUsd: nonnegative,
});
const sharedSchema = object({
  accessIssuer,
  accountId: id,
  adminEmails: pipe(array(emailAddress), minLength(1), maxLength(MAX_ADMIN_EMAILS), readonly()),
  adminOrigin: origin,
  budget: budgetSchema,
  mailFrom: emailAddress,
  otelEndpoint: httpsUrl,
  prefix: pipe(string(), regex(/^[a-z][a-z0-9-]{2,35}$/u)),
  sentryDsn: optional(sentryDsn),
  sentryEnvironment: optional(sentrySchemas.environment),
  sentryRelease: optional(sentrySchemas.release),
  userOrigin: origin,
  wikiOrigin: origin,
  zoneId: id,
});
const headerValue = pipe(
  string(),
  check((item) => !/[\r\n]/u.test(item)),
);
const otelHeadersSchema = record(
  pipe(string(), regex(/^[!#$%&'*+.^_`|~0-9a-zA-Z-]+$/u)),
  headerValue,
);

type SharedConfig = InferOutput<typeof sharedSchema>;
type AppTarget = "user" | "admin" | "wiki";
type SentrySettings = Readonly<
  Pick<SharedConfig, "sentryDsn" | "sentryEnvironment" | "sentryRelease">
>;
type AppOrigins = Readonly<
  Pick<SharedConfig, "adminOrigin" | "prefix" | "userOrigin" | "wikiOrigin">
>;

interface DeploymentCommand {
  operation: "preview" | "up";
  target: "shared" | AppTarget;
}

interface PlainTextBinding {
  name: string;
  text: string;
  type: "plain_text";
}

interface AppPolicy {
  readonly assets: { readonly runWorkerFirst: boolean };
  readonly name: string;
  readonly origin: string;
  readonly subdomain: { readonly enabled: boolean; readonly previewsEnabled: boolean };
}

interface PermissionGroup {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
}

function present(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function parseDeploymentCommand(args: readonly string[]): DeploymentCommand {
  const [operation, target] = args;
  if (
    args.length !== DEPLOYMENT_COMMAND_LENGTH ||
    (operation !== "preview" && operation !== "up") ||
    (target !== "shared" && target !== "user" && target !== "admin" && target !== "wiki")
  ) {
    throw new Error("deployment_command_invalid");
  }
  return { operation, target };
}

function assertSentryComplete(config: SentrySettings): void {
  if (
    present(config.sentryDsn) &&
    (!present(config.sentryEnvironment) || !present(config.sentryRelease))
  ) {
    throw new Error("sentry_environment_and_release_required");
  }
}

function assertDistinctOrigins(config: AppOrigins): void {
  const origins = [config.userOrigin, config.adminOrigin, config.wikiOrigin];
  if (new Set(origins).size !== origins.length) {
    throw new Error("app_origins_must_differ");
  }
}

function assertBudgetAllowance(budget: Readonly<Omit<SharedConfig["budget"], "recipients">>): void {
  if (budget.budgetJpy / budget.jpyPerUsd <= budget.fixedCostUsd + budget.reserveUsd) {
    throw new Error("budget_has_no_usage_allowance");
  }
}

function parseSharedConfig(input: unknown): SharedConfig {
  const parsed = safeParse(sharedSchema, input);
  if (!parsed.success) {
    throw new Error("cloudflare_settings_invalid");
  }
  const config = parsed.output;
  assertSentryComplete(config);
  assertDistinctOrigins(config);
  assertBudgetAllowance(config.budget);
  return config;
}

function sentryRuntimeBindings(config: SentrySettings): PlainTextBinding[] {
  if (!present(config.sentryDsn)) {
    return [];
  }
  if (!present(config.sentryEnvironment) || !present(config.sentryRelease)) {
    throw new Error("sentry_environment_and_release_required");
  }
  return [
    { name: "SENTRY_DSN", text: config.sentryDsn, type: "plain_text" },
    { name: "SENTRY_ENVIRONMENT", text: config.sentryEnvironment, type: "plain_text" },
    { name: "SENTRY_RELEASE", text: config.sentryRelease, type: "plain_text" },
  ];
}

function validateAuthSecret(secret: string): string {
  if (secret.length < MIN_AUTH_SECRET_LENGTH || secret.trim() !== secret) {
    throw new Error("auth_secret_invalid");
  }
  return secret;
}

function validateOtelHeaders(value: string): string {
  try {
    const input: unknown = JSON.parse(value);
    const result = safeParse(otelHeadersSchema, input);
    if (!result.success) {
      throw new Error("invalid");
    }
    return JSON.stringify(result.output);
  } catch {
    throw new Error("otel_headers_invalid");
  }
}

function appPolicy(config: AppOrigins, target: AppTarget): AppPolicy {
  return {
    assets: { runWorkerFirst: true },
    name: `${config.prefix}-${target}`,
    origin: { admin: config.adminOrigin, user: config.userOrigin, wiki: config.wikiOrigin }[target],
    subdomain: { enabled: false, previewsEnabled: false },
  };
}

function selectReadPermission(groups: readonly PermissionGroup[]): string {
  const matches = groups.filter(
    (group) => group.name === "Billing Read" && group.scopes.includes("com.cloudflare.api.account"),
  );
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    throw new Error("billing_read_permission_unavailable");
  }
  return parse(id, match.id);
}

export {
  appPolicy,
  parseDeploymentCommand,
  parseSharedConfig,
  selectReadPermission,
  sentryRuntimeBindings,
  validateAuthSecret,
  validateOtelHeaders,
};
export type { AppTarget, SharedConfig };
