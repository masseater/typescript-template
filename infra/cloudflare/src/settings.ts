import { GoogleAnalyticsMeasurementId } from "@repo/config";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Config, Effect, Option, Redacted, Schema } from "effect";

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

function optional<Value>(config: Config.Config<Value>): Config.Config<Value | undefined> {
  return Config.option(config).pipe(Config.map(Option.getOrUndefined));
}

const budget = Config.all({
  budgetJpy: Config.schema(Positive, deploymentKey.budgetJpy),
  fixedCostUsd: Config.schema(Nonnegative, deploymentKey.fixedCostUsd),
  jpyPerUsd: Config.schema(Positive, deploymentKey.jpyPerUsd),
  recipients: Config.Array(Email, deploymentKey.alertEmail).pipe(
    Config.mapEffect((recipients) =>
      Schema.decodeEffect(Recipients)(recipients).pipe(
        Effect.mapError((error) => new Config.ConfigError(error)),
      ),
    ),
  ),
  reserveUsd: Config.schema(Nonnegative, deploymentKey.reserveUsd),
});

const otlpDestination = Config.all({
  enabled: optional(Config.Boolean(deploymentKey.otlpEnabled)),
  endpoint: optional(Config.schema(HttpsUrl, deploymentKey.otlpEndpoint)),
});

const googleAnalyticsMeasurementId = optional(
  Config.schema(GoogleAnalyticsMeasurementId, deploymentKey.googleAnalyticsMeasurementId),
);

const settings = Config.all({
  accountId: Config.schema(CloudflareId, deploymentKey.cloudflareAccountId),
  appDomain: Config.schema(Domain, deploymentKey.appDomain),
  budget,
  googleAnalyticsMeasurementId,
  mailFrom: Config.schema(Email, deploymentKey.mailFrom),
  observabilitySampling: Config.schema(SamplingRate, deploymentKey.observabilitySampling),
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

const otlpAuthorization = optional(Config.Redacted(deploymentKey.otlpAuthorization));

const stripeSettings = Config.all({
  STRIPE_PRICE_ID: Config.Redacted(deploymentKey.stripePriceId),
  STRIPE_SECRET_KEY: Config.Redacted(deploymentKey.stripeSecretKey),
  STRIPE_WEBHOOK_SECRET: Config.Redacted(deploymentKey.stripeWebhookSecret),
});

export { authSecret, otlpAuthorization, settings, stripeSettings };
