import { env as processEnvironment } from "node:process";

import { appEnvKey, applicationOrigins, mailpitOrigin } from "@repo/config";
import { receiverOrigin } from "@repo/local";
import { Crypto, Effect } from "effect";

import { OriginMode, lanOrigin } from "./local-environment.ts";

import type { App, Credentials } from "./local-environment.ts";

const sharedRunnerSeed = "continuous-integration";

const sharedRunnerCredentials = Effect.fn("sharedRunnerCredentials")(
  function* sharedRunnerCredentials() {
    const crypto = yield* Crypto.Crypto;
    const digest = yield* crypto
      .digest("SHA-256", new TextEncoder().encode(sharedRunnerSeed))
      .pipe(Effect.orDie);
    const credentials: Credentials & { readonly origins: "loopback" } = {
      authSecret: Buffer.from(digest).toString("base64url"),
      origins: "loopback",
    };
    return credentials;
  },
);

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

const ciCredentials = (): boolean => processEnvironment["CI"] !== undefined;

export { appVariables, ciCredentials, sharedRunnerCredentials };
