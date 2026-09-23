import { applicationOrigins } from "@repo/config";
import { Effect } from "effect";

import { browserLaunchArguments } from "./lan-gateway.ts";
import { browserConfig, lanOrigin } from "./local-environment.ts";
import { urlPath } from "./platform.ts";

import type { App, Credentials } from "./local-environment.ts";

function sessionName(app: App): string {
  return `template-local-${app}`;
}

function configuredOrigin(app: App, credentials: Credentials): string {
  return credentials.origins === "loopback" ? applicationOrigins[app] : lanOrigin(app);
}

const sessionArguments = Effect.fn("sessionArguments")(function* sessionArguments(
  app: App,
  credentials: Credentials,
) {
  const launch =
    credentials.origins === "loopback" ? ([] as const) : yield* browserLaunchArguments();
  const config = yield* urlPath(browserConfig);
  return ["--config", config, ...launch, "--session", sessionName(app)];
});

export { configuredOrigin, sessionArguments, sessionName };
