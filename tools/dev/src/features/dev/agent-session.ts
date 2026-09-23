import { env as processEnvironment } from "node:process";

import { applicationOrigins } from "@repo/config";
import { Effect } from "effect";

import { browserLaunchArguments } from "./lan-gateway.ts";
import { browserConfig, lanOrigin, root, run } from "./local-environment.ts";
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

const agent = Effect.fn("agent")(function* agent(
  app: App,
  credentials: Credentials,
  socketDirectory: string,
  args: readonly string[],
) {
  const env = { ...processEnvironment, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  yield* run("agent-browser", [...(yield* sessionArguments(app, credentials)), ...args], {
    cwd: root,
    env,
  });
});

export { agent, configuredOrigin, sessionArguments, sessionName };
