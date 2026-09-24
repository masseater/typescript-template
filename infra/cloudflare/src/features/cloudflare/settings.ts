import { GoogleAnalyticsMeasurementId, readWikiPublishConfig, wikiPublishKey } from "@repo/config";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Config, Effect, Option, Redacted, Schema } from "effect";

import {
  AuthSecret,
  CloudflareId,
  Domain,
  Email,
  HttpsUrl,
  Positive,
  Prefix,
  Recipients,
  checkOtlpSettings,
  checkSharedConfig,
  deriveOrigins,
} from "./config.ts";

function optional<Value>(config: Config.Config<Value>): Config.Config<Value | undefined> {
  return Config.option(config).pipe(Config.map(Option.getOrUndefined));
}

const budget = Config.all({
  budgetJpy: Config.schema(Positive, deploymentKey.budgetJpy),
  recipients: Config.Array(Email, deploymentKey.alertEmail).pipe(
    Config.mapEffect((recipients) =>
      Schema.decodeEffect(Recipients)(recipients).pipe(
        Effect.mapError((error) => new Config.ConfigError(error)),
      ),
    ),
  ),
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

const wikiPublishSettings = Config.all({
  appId: optional(Config.String(deploymentKey.wikiPublishAppId)),
  privateKey: optional(Config.Redacted(deploymentKey.wikiPublishPrivateKey)),
  repository: optional(Config.String(deploymentKey.wikiPublishRepository)),
}).pipe(
  Effect.flatMap(({ appId, privateKey, repository }) =>
    readWikiPublishConfig(
      Object.fromEntries(
        [
          [wikiPublishKey.appId, appId],
          [
            wikiPublishKey.privateKey,
            privateKey === undefined ? undefined : Redacted.value(privateKey),
          ],
          [wikiPublishKey.repository, repository],
        ].filter(([, value]) => value !== undefined),
      ),
    ).pipe(
      Effect.map((config) =>
        config === undefined
          ? undefined
          : {
              [wikiPublishKey.appId]: config.appId,
              [wikiPublishKey.privateKey]: config.privateKey,
              [wikiPublishKey.repository]: `${config.owner}/${config.repository}`,
            },
      ),
    ),
  ),
);

export { authSecret, otlpAuthorization, settings, stripeSettings, wikiPublishSettings };
