import { createHash } from "node:crypto";

import { appEnvKey, applicationOrigins, grants, mailpitOrigin } from "@repo/config";
import { receiverOrigin } from "@repo/local";

import { OriginMode, lanOrigin } from "./local-environment.ts";

import type { App, Credentials } from "./local-environment.ts";

const sharedRunnerSeed = "continuous-integration";

const stripePlaceholders = {
  priceId: "price_localPlaceholderNotReal",
  secretKey: "sk_test_localPlaceholderNotAReal",
  webhookSecret: "whsec_localPlaceholderNotReal",
} as const;

function sharedRunnerCredentials(): Credentials {
  return {
    authSecret: createHash("sha256").update(sharedRunnerSeed).digest("base64url"),
    origins: "loopback",
  };
}

function appOrigin(app: App, mode: typeof OriginMode.Type): string {
  return mode === "lan" ? lanOrigin(app) : applicationOrigins[app];
}

function billingVariables(app: App, credentials: Credentials): Readonly<Record<string, string>> {
  if (!grants(app, "billing")) {
    return {};
  }
  const stripe = credentials.stripe ?? stripePlaceholders;
  return {
    STRIPE_PRICE_ID: stripe.priceId,
    STRIPE_SECRET_KEY: stripe.secretKey,
    STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
  };
}

function appVariables(
  app: App,
  credentials: Credentials,
  mode: typeof OriginMode.Type,
): Readonly<Record<string, string>> {
  return {
    [appEnvKey.appOrigin]: appOrigin(app, mode),
    [appEnvKey.authSecret]: credentials.authSecret,
    [appEnvKey.emailFrom]: "no-reply@example.test",
    [appEnvKey.mailpitUrl]: mailpitOrigin,
    [appEnvKey.opsEmail]: "ops@example.test",
    [appEnvKey.otlpEndpoint]: receiverOrigin("otlp"),
    ...billingVariables(app, credentials),
  };
}

export { appVariables, sharedRunnerCredentials };
