// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";

import { applicationOrigins, mailpitOrigin } from "@repo/config";
import { receiverOrigin } from "@repo/local";

import { OriginMode, lanOrigin } from "./local-environment.ts";

import type { App, Credentials } from "./local-environment.ts";

const sharedRunnerSeed = "continuous-integration";

function sharedRunnerCredentials(): Credentials {
  return {
    authSecret: createHash("sha256").update(sharedRunnerSeed).digest("base64url"),
    origins: "loopback",
  };
}

function appOrigin(app: App, mode: typeof OriginMode.Type): string {
  return mode === "lan" ? lanOrigin(app) : applicationOrigins[app];
}

function appVariables(
  app: App,
  credentials: Credentials,
  mode: typeof OriginMode.Type,
): Readonly<Record<string, string>> {
  return {
    APP_ORIGIN: appOrigin(app, mode),
    AUTH_SECRET: credentials.authSecret,
    EMAIL_FROM: "no-reply@example.test",
    MAILPIT_URL: mailpitOrigin,
    OPS_EMAIL: "ops@example.test",
    OTLP_ENDPOINT: receiverOrigin("otlp"),
  };
}

export { appVariables, sharedRunnerCredentials };
