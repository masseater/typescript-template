import { Effect, Schema } from "effect";

export class CloudflareFailure extends Schema.TaggedError<CloudflareFailure>()(
  "CloudflareFailure",
  {
    code: Schema.Literals([
      "deployment_command_invalid",
      "cloudflare_settings_invalid",
      "app_origins_must_differ",
      "budget_has_no_usage_allowance",
      "auth_secret_invalid",
      "billing_read_permission_unavailable",
      "observability_query_permission_unavailable",
      "database_input_invalid",
    ]),
  },
) {}

const fail = (code: CloudflareFailure["code"]) => Effect.fail(new CloudflareFailure({ code }));

const Id = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/));
const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));
const Nonnegative = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
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

const SharedSettings = Schema.Struct({
  accountId: Id,
  zoneId: Id,
  prefix: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{2,35}$/)),
  userOrigin: Origin,
  adminOrigin: Origin,
  wikiOrigin: Origin,
  accessIssuer: Origin.check(
    Schema.makeFilter(
      (value: string) => URL.parse(value)?.hostname.endsWith(".cloudflareaccess.com") === true,
    ),
  ),
  adminEmails: Schema.Array(Email).check(Schema.isLengthBetween(1, 50)),
  mailFrom: Email,
  budget: Schema.Struct({
    budgetJpy: Positive,
    jpyPerUsd: Positive,
    fixedCostUsd: Nonnegative,
    reserveUsd: Nonnegative,
    recipients: Schema.Array(Email).check(Schema.isLengthBetween(1, 10)),
  }),
});

export type AppTarget = "user" | "admin" | "wiki";

export const parseDeploymentCommand = Effect.fn("parseDeploymentCommand")(function* (
  args: readonly string[],
) {
  const [operation, target] = args;
  if (
    args.length !== 2 ||
    (operation !== "preview" && operation !== "up") ||
    (target !== "shared" && target !== "user" && target !== "admin" && target !== "wiki")
  )
    return yield* fail("deployment_command_invalid");
  return { operation, target };
});

export const parseSharedConfig = Effect.fn("parseSharedConfig")(function* (input: unknown) {
  const config = yield* Schema.decodeUnknownEffect(SharedSettings)(input).pipe(
    Effect.mapError(() => new CloudflareFailure({ code: "cloudflare_settings_invalid" })),
  );
  if (new Set([config.userOrigin, config.adminOrigin, config.wikiOrigin]).size !== 3)
    return yield* fail("app_origins_must_differ");
  if (
    config.budget.budgetJpy / config.budget.jpyPerUsd <=
    config.budget.fixedCostUsd + config.budget.reserveUsd
  )
    return yield* fail("budget_has_no_usage_allowance");
  return config;
});

export const validateAuthSecret = Effect.fn("validateAuthSecret")(function* (secret: unknown) {
  if (typeof secret !== "string" || secret.length < 32 || secret.trim() !== secret)
    return yield* fail("auth_secret_invalid");
  return secret;
});

export function appPolicy(config: typeof SharedSettings.Type, target: AppTarget) {
  return {
    name: `${config.prefix}-${target}`,
    origin: { user: config.userOrigin, admin: config.adminOrigin, wiki: config.wikiOrigin }[target],
    subdomain: { enabled: false, previewsEnabled: false },
    assets: { runWorkerFirst: true },
  };
}

const selectPermission = Effect.fn("selectPermission")(function* (
  groups: readonly { id: string; name: string; scopes: string[] }[],
  name: string,
  code: CloudflareFailure["code"],
) {
  const matches = groups.filter(
    (group) => group.name === name && group.scopes.includes("com.cloudflare.api.account"),
  );
  if (matches.length !== 1) return yield* fail(code);
  return yield* Schema.decodeUnknownEffect(Id)(matches[0]?.id).pipe(
    Effect.mapError(() => new CloudflareFailure({ code })),
  );
});

export const selectReadPermission = (
  groups: readonly { id: string; name: string; scopes: string[] }[],
) => selectPermission(groups, "Billing Read", "billing_read_permission_unavailable");

export const selectObservabilityQueryPermission = (
  groups: readonly { id: string; name: string; scopes: string[] }[],
) =>
  selectPermission(
    groups,
    "Workers Observability Write",
    "observability_query_permission_unavailable",
  );
