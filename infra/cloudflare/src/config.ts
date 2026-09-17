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
  picklist,
  pipe,
  readonly,
  regex,
  safeParse,
  strictTuple,
  string,
  url,
} from "valibot";
import type { InferOutput } from "valibot";
import { applyPlan } from "./stacks.ts";

const MAX_BUDGET_RECIPIENTS = 10;
const MIN_AUTH_SECRET_LENGTH = 32;

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
const budgetSchema = object({
  budgetJpy: positive,
  fixedCostUsd: nonnegative,
  jpyPerUsd: positive,
  recipients: pipe(array(emailAddress), minLength(1), maxLength(MAX_BUDGET_RECIPIENTS), readonly()),
  reserveUsd: nonnegative,
});
const sharedSchema = object({
  accountId: id,
  budget: budgetSchema,
  mailFrom: emailAddress,
  origins: object({ admin: origin, user: origin, wiki: origin }),
  prefix: pipe(string(), regex(/^[a-z][a-z0-9-]{2,35}$/u)),
  zoneId: id,
});
const deploymentCommandSchema = strictTuple([
  picklist(["preview", "up"]),
  picklist(["all", ...applyPlan().map(({ stack }) => stack)]),
]);

type SharedConfig = InferOutput<typeof sharedSchema>;
type DeploymentCommand = Readonly<{
  operation: InferOutput<typeof deploymentCommandSchema>[0];
  targets: ReturnType<typeof applyPlan>;
}>;
type AccountPermission = "Billing Read" | "Workers Observability Write";

interface PermissionGroup {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
}

const workerSubdomain = { enabled: false, previewsEnabled: false } as const;

function parseDeploymentCommand(args: readonly string[]): DeploymentCommand {
  const parsed = safeParse(deploymentCommandSchema, args);
  if (!parsed.success) {
    throw new Error("deployment_command_invalid");
  }
  const [operation, target] = parsed.output;
  const plan = applyPlan();
  return {
    operation,
    targets: target === "all" ? plan : plan.filter(({ stack }) => stack === target),
  };
}

function assertDistinctOrigins(config: Readonly<Pick<SharedConfig, "origins">>): void {
  const origins = Object.values(config.origins);
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

function selectAccountPermission(
  groups: readonly PermissionGroup[],
  name: AccountPermission,
): string {
  const matches = groups.filter(
    (group) => group.name === name && group.scopes.includes("com.cloudflare.api.account"),
  );
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    throw new Error("account_permission_unavailable");
  }
  return parse(id, match.id);
}

export {
  parseDeploymentCommand,
  parseSharedConfig,
  selectAccountPermission,
  validateAuthSecret,
  workerSubdomain,
};
export type { AccountPermission, SharedConfig };
