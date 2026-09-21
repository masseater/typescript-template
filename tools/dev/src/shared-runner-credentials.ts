import { createHash } from "node:crypto";

import { appEnvKey, applicationOrigins, mailpitOrigin } from "@repo/config";
import { receiverOrigin } from "@repo/local";

import { OriginMode, lanOrigin } from "./local-environment.ts";

import type { App, Credentials } from "./local-environment.ts";

const sharedRunnerSeed = "continuous-integration";

function sharedRunnerCredentials(): Credentials & { readonly origins: "loopback" } {
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
    [appEnvKey.appOrigin]: appOrigin(app, mode),
    [appEnvKey.authSecret]: credentials.authSecret,
    [appEnvKey.emailFrom]: "no-reply@example.test",
    [appEnvKey.mailpitUrl]: mailpitOrigin,
    [appEnvKey.opsEmail]: "ops@example.test",
    [appEnvKey.otlpEndpoint]: receiverOrigin("otlp"),
  };
}

export { appVariables, sharedRunnerCredentials };
