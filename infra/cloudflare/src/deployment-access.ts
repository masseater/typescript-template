import { Config, Effect, Redacted } from "effect";
import type { Confidential } from "./secrets.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import type { SharedConfig } from "./config.ts";
import { State as StateRoute } from "alchemy/Alchemist";
import { settings } from "./settings.ts";
import { verifiedSecrets } from "./credentials.ts";
import { withVerifiedSecrets } from "./secrets.ts";

const apiToken = Config.redacted("CLOUDFLARE_API_TOKEN");

function byLongest(left: Confidential, right: Confidential): number {
  return right.value.length - left.value.length;
}

function confidentialValues(
  config: SharedConfig,
  secrets: DeploymentSecrets,
): readonly Confidential[] {
  const origins = Object.entries(config.origins).flatMap(
    ([app, origin]: readonly [string, string]) => {
      const key = `TEMPLATE_${app.toUpperCase()}_ORIGIN`;
      return [
        { key, value: origin },
        { key, value: new URL(origin).hostname },
      ];
    },
  );
  return [
    { key: "CLOUDFLARE_ACCOUNT_ID", value: config.accountId },
    { key: "CLOUDFLARE_ZONE_ID", value: config.zoneId },
    { key: "TEMPLATE_CLOUDFLARE_ENV_FILE", value: secrets.filename },
    { key: "TEMPLATE_MAIL_FROM", value: config.mailFrom },
    { key: "TEMPLATE_PREFIX", value: config.prefix },
    ...origins,
    ...config.budget.recipients.map((recipient) => ({ key: "ALERT_EMAIL", value: recipient })),
  ].toSorted(byLongest);
}

const deploymentAccess = Effect.fn("deploymentAccess")(function* deploymentAccess() {
  const secrets = yield* verifiedSecrets();
  const config = yield* withVerifiedSecrets(secrets, settings);
  const token = yield* withVerifiedSecrets(secrets, apiToken);
  return {
    access: { accountId: config.accountId, apiToken: Redacted.value(token) },
    confidential: confidentialValues(config, secrets),
    config,
    secrets,
  };
});

function stateStore(secrets: DeploymentSecrets): ReturnType<typeof StateRoute.store> {
  return StateRoute.store({ backend: "cloudflare", envFile: secrets.filename });
}

export { deploymentAccess, stateStore };
