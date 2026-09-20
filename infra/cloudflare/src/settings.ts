import { APPLICATION } from "@repo/config";
import { Config, Effect, Option, Redacted } from "effect";

import {
  AuthSecret,
  CloudflareId,
  Domain,
  Email,
  HttpsUrl,
  Nonnegative,
  Positive,
  Prefix,
  Recipients,
  SamplingRate,
  checkOtlpSettings,
  checkSharedConfig,
  deriveOrigins,
} from "./config.ts";

const DEFAULT_JPY_PER_USD = 150;
const FULL_SAMPLING = 1;
const DEFAULT_USD = 0;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function optional<Value>(config: Config.Config<Value>): Config.Config<Value | undefined> {
  return Config.option(config).pipe(Config.map(Option.getOrUndefined));
}

const budget = Config.all({
  budgetJpy: Config.schema(Positive, "BUDGET_JPY"),
  fixedCostUsd: Config.schema(Nonnegative, "TEMPLATE_FIXED_COST_USD").pipe(
    Config.withDefault(DEFAULT_USD),
  ),
  jpyPerUsd: Config.schema(Positive, "TEMPLATE_JPY_PER_USD").pipe(
    Config.withDefault(DEFAULT_JPY_PER_USD),
  ),
  recipients: Config.schema(Recipients, "ALERT_EMAIL"),
  reserveUsd: Config.schema(Nonnegative, "TEMPLATE_RESERVE_USD").pipe(
    Config.withDefault(DEFAULT_USD),
  ),
});

const otlpDestination = Config.all({
  enabled: optional(Config.boolean("TEMPLATE_OTLP_ENABLED")),
  endpoint: optional(Config.schema(HttpsUrl, "TEMPLATE_OTLP_ENDPOINT")),
});

const settings = Config.all({
  accountId: Config.schema(CloudflareId, "CLOUDFLARE_ACCOUNT_ID"),
  appDomain: Config.schema(Domain, "TEMPLATE_APP_DOMAIN"),
  budget,
  mailFrom: Config.schema(Email, "TEMPLATE_MAIL_FROM"),
  observabilitySampling: Config.schema(SamplingRate, "TEMPLATE_OBSERVABILITY_SAMPLING").pipe(
    Config.withDefault(FULL_SAMPLING),
  ),
  otlp: otlpDestination,
  prefix: Config.schema(Prefix, "TEMPLATE_PREFIX"),
  zoneId: Config.schema(CloudflareId, "CLOUDFLARE_ZONE_ID"),
}).pipe(
  Effect.flatMap(({ appDomain, ...config }) =>
    checkOtlpSettings(config.otlp).pipe(
      Effect.flatMap((otlp) =>
        checkSharedConfig({ ...config, origins: deriveOrigins(config.prefix, appDomain), otlp }),
      ),
    ),
  ),
);

const authSecret = Config.schema(AuthSecret, "TEMPLATE_AUTH_SECRET").pipe(
  Config.map(Redacted.make),
);

const otlpAuthorization = optional(Config.redacted("TEMPLATE_OTLP_AUTHORIZATION"));

export { authSecret, otlpAuthorization, settings };
