import { deploymentKey } from "@repo/observability/deployment-keys";
import { State as StateRoute } from "alchemy/Alchemist";
import { Config, Effect, Redacted } from "effect";

import { verifiedSecrets } from "./credentials.ts";
import { ENVIRONMENT_FILE_VARIABLE } from "./deployment.ts";
import { withVerifiedSecrets } from "./secrets.ts";
import { otlpAuthorization, settings } from "./settings.ts";

import type { SharedConfig } from "./config.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import type { Confidential } from "./secrets.ts";

const apiToken = Config.redacted(deploymentKey.cloudflareApiToken);

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
          { key: deploymentKey.otlpEndpoint, value: config.otlp.endpoint },
          { key: deploymentKey.otlpEndpoint, value: new URL(config.otlp.endpoint).hostname },
        ]),
    ...(authorization === undefined
      ? []
      : [{ key: deploymentKey.otlpAuthorization, value: Redacted.value(authorization) }]),
  ];
}

function confidentialValues(
  config: SharedConfig,
  secrets: DeploymentSecrets,
  authorization: Redacted.Redacted | undefined,
): readonly Confidential[] {
  const origins = Object.values(config.origins).flatMap((origin) => [
    { key: deploymentKey.appDomain, value: origin },
    { key: deploymentKey.appDomain, value: new URL(origin).hostname },
  ]);
  return [
    { key: deploymentKey.cloudflareAccountId, value: config.accountId },
    { key: deploymentKey.cloudflareZoneId, value: config.zoneId },
    { key: ENVIRONMENT_FILE_VARIABLE, value: secrets.filename },
    { key: deploymentKey.mailFrom, value: config.mailFrom },
    { key: deploymentKey.prefix, value: config.prefix },
    ...origins,
    ...otlpValues(config, authorization),
    ...config.budget.recipients.map((recipient) => ({
      key: deploymentKey.alertEmail,
      value: recipient,
    })),
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
