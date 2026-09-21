// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { APPLICATION, applicationOrigins } from "@repo/config";
import { Effect } from "effect";
import { URI } from "otpauth";

import { failure } from "./failure.ts";
import { browserLaunchArguments } from "./lan-gateway.ts";
import {
  browserConfig,
  lanOrigin,
  readCredentials,
  refreshBrowserConfig,
  root,
  run,
} from "./local-environment.ts";
import { ensureOperators, operatorFile } from "./operator-account.ts";

import type { App, Credentials } from "./local-environment.ts";
import type { Operator } from "./operator-account.ts";

interface AuthenticateReport {
  readonly app: App;
  readonly email: string;
  readonly event: "local.browser_authenticated";
  readonly ok: true;
  readonly operatorFile: string;
  readonly origin: string;
  readonly secretsPrinted: false;
  readonly session: string;
}

const loginSettleMilliseconds = "2500";

function sessionName(app: App): string {
  return `template-local-${app}`;
}

const postLoginPaths: Readonly<Record<App, string>> = {
  [APPLICATION.admin]: "/members",
  [APPLICATION.user]: "/home",
  [APPLICATION.wiki]: "/",
};

function configuredOrigin(app: App, credentials: Credentials): string {
  return credentials.origins === "loopback" ? applicationOrigins[app] : lanOrigin(app);
}

const sessionArguments = Effect.fn("sessionArguments")(function* sessionArguments(
  app: App,
  credentials: Credentials,
) {
  const launch =
    credentials.origins === "loopback" ? ([] as const) : yield* browserLaunchArguments();
  return ["--config", fileURLToPath(browserConfig), ...launch, "--session", sessionName(app)];
});

const agent = Effect.fn("agent")(function* agent(
  app: App,
  credentials: Credentials,
  socketDirectory: string,
  args: readonly string[],
) {
  // oxlint-disable-next-line node/no-process-env
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  yield* run("agent-browser", [...(yield* sessionArguments(app, credentials)), ...args], {
    cwd: root,
    env,
  });
});

const signInThroughBrowser = Effect.fn("signInThroughBrowser")(function* signInThroughBrowser(
  app: App,
  credentials: Credentials,
  operator: Operator,
) {
  const socketDirectory = yield* refreshBrowserConfig();
  const origin = configuredOrigin(app, credentials);
  yield* agent(app, credentials, socketDirectory, ["open", `${origin}/login`]);
  yield* agent(app, credentials, socketDirectory, [
    "find",
    "label",
    "メールアドレス",
    "fill",
    operator.email,
  ]);
  yield* agent(app, credentials, socketDirectory, [
    "find",
    "label",
    "パスワード",
    "fill",
    operator.password,
  ]);
  yield* agent(app, credentials, socketDirectory, [
    "eval",
    "document.querySelector('form')?.requestSubmit(); true",
  ]);
  yield* agent(app, credentials, socketDirectory, ["wait", loginSettleMilliseconds]);
  yield* agent(app, credentials, socketDirectory, [
    "find",
    "label",
    "認証アプリの確認コード",
    "fill",
    URI.parse(operator.totpURI).generate(),
  ]);
  yield* agent(app, credentials, socketDirectory, [
    "eval",
    "document.querySelector('form')?.requestSubmit(); true",
  ]);
  yield* agent(app, credentials, socketDirectory, ["wait", loginSettleMilliseconds]);
  yield* agent(app, credentials, socketDirectory, ["open", `${origin}${postLoginPaths[app]}`]);
  yield* agent(app, credentials, socketDirectory, ["wait", loginSettleMilliseconds]);
  return origin;
});

const authenticate = Effect.fn("authenticate")(function* authenticate(
  app: App,
  _args: readonly string[] = [],
) {
  const credentials = yield* readCredentials();
  const operator = (yield* ensureOperators())[app];
  const origin = yield* signInThroughBrowser(app, credentials, operator).pipe(
    Effect.mapError(() => failure("browser_authentication_failed")),
  );
  const report: AuthenticateReport = {
    app,
    email: operator.email,
    event: "local.browser_authenticated",
    ok: true,
    operatorFile: fileURLToPath(operatorFile),
    origin,
    secretsPrinted: false,
    session: sessionName(app),
  };
  return report;
});

export { authenticate };
