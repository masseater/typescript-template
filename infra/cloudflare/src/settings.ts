import { deploymentKey } from "@repo/observability/deployment-keys";
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

function optional<Value>(config: Config.Config<Value>): Config.Config<Value | undefined> {
  return Config.option(config).pipe(Config.map(Option.getOrUndefined));
}

const budget = Config.all({
  budgetJpy: Config.schema(Positive, deploymentKey.budgetJpy),
  fixedCostUsd: Config.schema(Nonnegative, deploymentKey.fixedCostUsd).pipe(
    Config.withDefault(DEFAULT_USD),
  ),
  jpyPerUsd: Config.schema(Positive, deploymentKey.jpyPerUsd).pipe(
    Config.withDefault(DEFAULT_JPY_PER_USD),
  ),
  recipients: Config.schema(Recipients, deploymentKey.alertEmail),
  reserveUsd: Config.schema(Nonnegative, deploymentKey.reserveUsd).pipe(
    Config.withDefault(DEFAULT_USD),
  ),
});

const otlpDestination = Config.all({
  enabled: optional(Config.boolean(deploymentKey.otlpEnabled)),
  endpoint: optional(Config.schema(HttpsUrl, deploymentKey.otlpEndpoint)),
});

const settings = Config.all({
  accountId: Config.schema(CloudflareId, deploymentKey.cloudflareAccountId),
  appDomain: Config.schema(Domain, deploymentKey.appDomain),
  budget,
  mailFrom: Config.schema(Email, deploymentKey.mailFrom),
  observabilitySampling: Config.schema(SamplingRate, deploymentKey.observabilitySampling).pipe(
    Config.withDefault(FULL_SAMPLING),
  ),
  otlp: otlpDestination,
  prefix: Config.schema(Prefix, deploymentKey.prefix),
  zoneId: Config.schema(CloudflareId, deploymentKey.cloudflareZoneId),
}).pipe(
  Effect.flatMap(({ appDomain, ...config }) =>
    checkOtlpSettings(config.otlp).pipe(
      Effect.flatMap((otlp) =>
        checkSharedConfig({ ...config, origins: deriveOrigins(config.prefix, appDomain), otlp }),
      ),
    ),
  ),
);

const authSecret = Config.schema(AuthSecret, deploymentKey.authSecret).pipe(
  Config.map(Redacted.make),
);

const otlpAuthorization = optional(Config.redacted(deploymentKey.otlpAuthorization));

const stripeSettings = Config.all({
  STRIPE_PRICE_ID: Config.redacted(deploymentKey.stripePriceId),
  STRIPE_SECRET_KEY: Config.redacted(deploymentKey.stripeSecretKey),
  STRIPE_WEBHOOK_SECRET: Config.redacted(deploymentKey.stripeWebhookSecret),
});

export { authSecret, otlpAuthorization, settings, stripeSettings };
