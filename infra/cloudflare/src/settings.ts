<<<<<<< HEAD
import { deploymentKey } from "@repo/observability/deployment-keys";
=======
import { GoogleAnalyticsMeasurementId } from "@repo/config";
>>>>>>> 71ec8b05 (Add optional Google Analytics measurement ID to config and Cloudflare stacks)
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

const googleAnalyticsMeasurementId = optional(
  Config.schema(GoogleAnalyticsMeasurementId, "TEMPLATE_GOOGLE_ANALYTICS_MEASUREMENT_ID"),
);

const settings = Config.all({
  accountId: Config.schema(CloudflareId, deploymentKey.cloudflareAccountId),
  appDomain: Config.schema(Domain, deploymentKey.appDomain),
  budget,
<<<<<<< HEAD
  mailFrom: Config.schema(Email, deploymentKey.mailFrom),
  observabilitySampling: Config.schema(SamplingRate, deploymentKey.observabilitySampling).pipe(
=======
  googleAnalyticsMeasurementId,
  mailFrom: Config.schema(Email, "TEMPLATE_MAIL_FROM"),
  observabilitySampling: Config.schema(SamplingRate, "TEMPLATE_OBSERVABILITY_SAMPLING").pipe(
>>>>>>> 71ec8b05 (Add optional Google Analytics measurement ID to config and Cloudflare stacks)
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

export { authSecret, otlpAuthorization, settings };
