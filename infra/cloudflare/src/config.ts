import * as v from "valibot";
import { sentrySchemas } from "@template/config";

const id = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/));
const positive = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));
const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const origin = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === value &&
      !url.hostname.endsWith(".workers.dev") &&
      !url.username &&
      !url.password
    );
  }),
);
const httpsUrl = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  }),
);
const sharedSchema = v.object({
  accountId: id,
  zoneId: id,
  prefix: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{2,35}$/)),
  userOrigin: origin,
  adminOrigin: origin,
  wikiOrigin: origin,
  accessIssuer: v.pipe(
    origin,
    v.check((value) => new URL(value).hostname.endsWith(".cloudflareaccess.com")),
  ),
  adminEmails: v.pipe(v.array(v.pipe(v.string(), v.email())), v.minLength(1), v.maxLength(50)),
  otelEndpoint: httpsUrl,
  sentryDsn: v.optional(
    v.pipe(
      sentrySchemas.dsn,
      v.check((value) => new URL(value).protocol === "https:"),
    ),
  ),
  sentryEnvironment: v.optional(sentrySchemas.environment),
  sentryRelease: v.optional(sentrySchemas.release),
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
export type AppTarget = "user" | "admin" | "wiki";

export function parseDeploymentCommand(args: readonly string[]) {
  const [operation, target] = args;
  if (
    args.length !== 2 ||
    (operation !== "preview" && operation !== "up") ||
    (target !== "shared" && target !== "user" && target !== "admin" && target !== "wiki")
  )
    throw new Error("deployment_command_invalid");
  return { operation, target };
}

export function parseSharedConfig(input: unknown): SharedConfig {
  const parsed = v.safeParse(sharedSchema, input);
  if (!parsed.success) throw new Error("cloudflare_settings_invalid");
  const config = parsed.output;
  if (config.sentryDsn && (!config.sentryEnvironment || !config.sentryRelease))
    throw new Error("sentry_environment_and_release_required");
  if (new Set([config.userOrigin, config.adminOrigin, config.wikiOrigin]).size !== 3)
    throw new Error("app_origins_must_differ");
  if (
    config.budget.budgetJpy / config.budget.jpyPerUsd <=
    config.budget.fixedCostUsd + config.budget.reserveUsd
  ) {
    throw new Error("budget_has_no_usage_allowance");
  }
  return config;
}

export function sentryRuntimeBindings(config: SharedConfig) {
  if (!config.sentryDsn) return [];
  if (!config.sentryEnvironment || !config.sentryRelease)
    throw new Error("sentry_environment_and_release_required");
  return [
    { type: "plain_text", name: "SENTRY_DSN", text: config.sentryDsn },
    { type: "plain_text", name: "SENTRY_ENVIRONMENT", text: config.sentryEnvironment },
    { type: "plain_text", name: "SENTRY_RELEASE", text: config.sentryRelease },
  ];
}

export function validateAuthSecret(secret: string): string {
  if (secret.length < 32 || secret.trim() !== secret) throw new Error("auth_secret_invalid");
  return secret;
}

export function validateOtelHeaders(value: string): string {
  try {
    const input: unknown = JSON.parse(value);
    const result = v.safeParse(
      v.record(
        v.pipe(v.string(), v.regex(/^[!#$%&'*+.^_`|~0-9a-zA-Z-]+$/)),
        v.pipe(
          v.string(),
          v.check((item) => !/[\r\n]/.test(item)),
        ),
      ),
      input,
    );
    if (!result.success) throw new Error("invalid");
    return JSON.stringify(result.output);
  } catch {
    throw new Error("otel_headers_invalid");
  }
}

export function appPolicy(config: SharedConfig, target: AppTarget) {
  return {
    name: `${config.prefix}-${target}`,
    origin: { user: config.userOrigin, admin: config.adminOrigin, wiki: config.wikiOrigin }[target],
    subdomain: { enabled: false, previewsEnabled: false },
    assets: { runWorkerFirst: true },
  };
}

export function selectReadPermission(
  groups: readonly { id: string; name: string; scopes: string[] }[],
): string {
  const matches = groups.filter(
    (group) => group.name === "Billing Read" && group.scopes.includes("com.cloudflare.api.account"),
  );
  if (matches.length !== 1) throw new Error("billing_read_permission_unavailable");
  return v.parse(id, matches[0]!.id);
}
