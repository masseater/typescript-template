import * as v from "valibot";
import { applyPlan } from "./stacks.ts";

const id = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/));
const positive = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));
const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const origin = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
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
const sharedSchema = v.object({
  accountId: id,
  zoneId: id,
  prefix: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{2,35}$/)),
  origins: v.object({ user: origin, admin: origin, wiki: origin }),
  mailFrom: v.pipe(v.string(), v.email()),
  budget: v.object({
    budgetJpy: positive,
    jpyPerUsd: positive,
    fixedCostUsd: nonnegative,
    reserveUsd: nonnegative,
    recipients: v.pipe(v.array(v.pipe(v.string(), v.email())), v.minLength(1), v.maxLength(10)),
  }),
});

export type SharedConfig = v.InferOutput<typeof sharedSchema>;

export const workerSubdomain = { enabled: false, previewsEnabled: false };

const deploymentCommand = v.strictTuple([
  v.picklist(["preview", "up"]),
  v.picklist(["all", ...applyPlan().map(({ stack }) => stack)]),
]);

export function parseDeploymentCommand(args: readonly string[]) {
  const parsed = v.safeParse(deploymentCommand, args);
  if (!parsed.success) throw new Error("deployment_command_invalid");
  const [operation, target] = parsed.output;
  const plan = applyPlan();
  return {
    operation,
    targets: target === "all" ? plan : plan.filter(({ stack }) => stack === target),
  };
}

export function parseSharedConfig(input: unknown): SharedConfig {
  const parsed = v.safeParse(sharedSchema, input);
  if (!parsed.success) throw new Error("cloudflare_settings_invalid");
  const config = parsed.output;
  const origins = Object.values(config.origins);
  if (new Set(origins).size !== origins.length) throw new Error("app_origins_must_differ");
  if (
    config.budget.budgetJpy / config.budget.jpyPerUsd <=
    config.budget.fixedCostUsd + config.budget.reserveUsd
  ) {
    throw new Error("budget_has_no_usage_allowance");
  }
  return config;
}

export function validateAuthSecret(secret: string): string {
  if (secret.length < 32 || secret.trim() !== secret) throw new Error("auth_secret_invalid");
  return secret;
}

export function selectAccountPermission(
  groups: readonly { id: string; name: string; scopes: string[] }[],
  name: "Billing Read" | "Workers Observability Write",
): string {
  const matches = groups.filter(
    (group) => group.name === name && group.scopes.includes("com.cloudflare.api.account"),
  );
  if (matches.length !== 1) throw new Error("account_permission_unavailable");
  return v.parse(id, matches[0]!.id);
}
