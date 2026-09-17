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
  parse,
  pipe,
  readonly,
  regex,
  safeParse,
  string,
  url,
} from "valibot";
import type { InferOutput } from "valibot";

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
    const parsed = URL.parse(value);
    return (
      parsed?.protocol === "https:" &&
      parsed.origin === value &&
      !parsed.hostname.endsWith(".workers.dev") &&
      !parsed.username &&
      !parsed.password
    );
  }),
);
const accessIssuer = pipe(
  origin,
  check((value) => URL.parse(value)?.hostname.endsWith(".cloudflareaccess.com") === true),
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
  prefix: pipe(string(), regex(/^[a-z][a-z0-9-]{2,35}$/u)),
  userOrigin: origin,
  wikiOrigin: origin,
  zoneId: id,
});

type SharedConfig = InferOutput<typeof sharedSchema>;
type AppTarget = "user" | "admin" | "wiki";
type AppOrigins = Readonly<
  Pick<SharedConfig, "adminOrigin" | "prefix" | "userOrigin" | "wikiOrigin">
>;

interface DeploymentCommand {
  operation: "preview" | "up";
  target: "shared" | AppTarget;
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
  assertDistinctOrigins(config);
  assertBudgetAllowance(config.budget);
  return config;
}

function validateAuthSecret(secret: string): string {
  if (secret.length < MIN_AUTH_SECRET_LENGTH || secret.trim() !== secret) {
    throw new Error("auth_secret_invalid");
  }
  return secret;
}

function appPolicy(config: AppOrigins, target: AppTarget): AppPolicy {
  return {
    assets: { runWorkerFirst: true },
    name: `${config.prefix}-${target}`,
    origin: { admin: config.adminOrigin, user: config.userOrigin, wiki: config.wikiOrigin }[target],
    subdomain: { enabled: false, previewsEnabled: false },
  };
}

function selectPermission(
  groups: readonly PermissionGroup[],
  permission: Readonly<{ error: string; name: string }>,
): string {
  const matches = groups.filter(
    (group) =>
      group.name === permission.name && group.scopes.includes("com.cloudflare.api.account"),
  );
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    throw new Error(permission.error);
  }
  return parse(id, match.id);
}

function selectReadPermission(groups: readonly PermissionGroup[]): string {
  return selectPermission(groups, {
    error: "billing_read_permission_unavailable",
    name: "Billing Read",
  });
}

function selectObservabilityQueryPermission(groups: readonly PermissionGroup[]): string {
  return selectPermission(groups, {
    error: "observability_query_permission_unavailable",
    name: "Workers Observability Write",
  });
}

export {
  appPolicy,
  parseDeploymentCommand,
  parseSharedConfig,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAuthSecret,
};
export type { AppTarget, SharedConfig };
