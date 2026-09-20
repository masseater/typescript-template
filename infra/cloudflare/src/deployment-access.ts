import { State as StateRoute } from "alchemy/Alchemist";
import { Config, Effect, Redacted } from "effect";

import { verifiedSecrets } from "./credentials.ts";
import { withVerifiedSecrets } from "./secrets.ts";
import { otlpAuthorization, settings } from "./settings.ts";

import type { SharedConfig } from "./config.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import type { Confidential } from "./secrets.ts";

const apiToken = Config.redacted("CLOUDFLARE_API_TOKEN");

function byLongest(left: Confidential, right: Confidential): number {
  return right.value.length - left.value.length;
}

function otlpValues(
  config: SharedConfig,
  authorization: Redacted.Redacted | undefined,
): readonly Confidential[] {
  return [
    ...(config.otlp === undefined
      ? []
      : [
          { key: "TEMPLATE_OTLP_ENDPOINT", value: config.otlp.endpoint },
          { key: "TEMPLATE_OTLP_ENDPOINT", value: new URL(config.otlp.endpoint).hostname },
        ]),
    ...(authorization === undefined
      ? []
      : [{ key: "TEMPLATE_OTLP_AUTHORIZATION", value: Redacted.value(authorization) }]),
  ];
}

function confidentialValues(
  config: SharedConfig,
  secrets: DeploymentSecrets,
  authorization: Redacted.Redacted | undefined,
): readonly Confidential[] {
  const origins = Object.values(config.origins).flatMap((origin) => [
    { key: "TEMPLATE_APP_DOMAIN", value: origin },
    { key: "TEMPLATE_APP_DOMAIN", value: new URL(origin).hostname },
  ]);
  return [
    { key: "CLOUDFLARE_ACCOUNT_ID", value: config.accountId },
    { key: "CLOUDFLARE_ZONE_ID", value: config.zoneId },
    { key: "TEMPLATE_CLOUDFLARE_ENV_FILE", value: secrets.filename },
    { key: "TEMPLATE_MAIL_FROM", value: config.mailFrom },
    { key: "TEMPLATE_PREFIX", value: config.prefix },
    ...origins,
    ...otlpValues(config, authorization),
    ...config.budget.recipients.map((recipient) => ({ key: "ALERT_EMAIL", value: recipient })),
  ].toSorted(byLongest);
}

const deploymentAccess = Effect.fn("deploymentAccess")(function* deploymentAccess() {
  const secrets = yield* verifiedSecrets();
  const config = yield* withVerifiedSecrets(secrets, settings);
  const token = yield* withVerifiedSecrets(secrets, apiToken);
  const authorization = yield* withVerifiedSecrets(secrets, otlpAuthorization);
  return {
    access: { accountId: config.accountId, apiToken: Redacted.value(token) },
    confidential: confidentialValues(config, secrets, authorization),
    config,
    secrets,
  };
});

function stateStore(secrets: DeploymentSecrets): ReturnType<typeof StateRoute.store> {
  return StateRoute.store({ backend: "cloudflare", envFile: secrets.filename });
}

export { deploymentAccess, stateStore };
