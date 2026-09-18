import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { applications } from "@template/config";
import { Effect } from "effect";

import { failure, fileIo, type LocalCommandFailure } from "./failure.ts";
import {
  credentialsFile,
  lanOrigin,
  local,
  readCredentials,
  refreshBrowserConfig,
  routes,
  type App,
  type Credentials,
} from "./local-environment.ts";
import {
  isErrorCode,
  privateDirectoryMode,
  replacePrivateFile,
  writePrivateFile,
} from "./private-files.ts";

type SetupReport = {
  readonly credentialsFile: string;
  readonly event: "local.app_configuration_ready";
  readonly ok: true;
  readonly secretsPrinted: false;
};

const authSecretBytes = 48;
const jsonIndentation = 2;

const credentialsExist = (): Effect.Effect<boolean, LocalCommandFailure> => {
  return Effect.tryPromise({
    catch: (cause): Readonly<{ missing: boolean }> => ({ missing: isErrorCode(cause, "ENOENT") }),
    try: async () => stat(credentialsFile),
  }).pipe(
    Effect.matchEffect({
      onFailure: ({ missing }) =>
        missing ? Effect.succeed(false) : Effect.fail(failure("file_io_failed")),
      onSuccess: () => Effect.succeed(true),
    }),
  );
};

const loadOrCreateCredentials = Effect.fn("loadOrCreateCredentials")(
  function* loadOrCreateCredentials() {
    if (!(yield* credentialsExist())) {
      const authSecret = randomBytes(authSecretBytes).toString("base64url");
      const content = JSON.stringify({ authSecret }, undefined, jsonIndentation);
      yield* writePrivateFile(credentialsFile, `${content}\n`);
    }
    return yield* readCredentials();
  },
);

const appVariables = (app: App, credentials: Credentials): Readonly<Record<string, string>> => {
  return {
    APP_ORIGIN: lanOrigin(app),
    AUTH_SECRET: credentials.authSecret,
    EMAIL_FROM: "no-reply@example.test",
    MAILPIT_URL: `http://127.0.0.1:${routes.mailpit}`,
  };
};

const writeAppVariables = (
  app: App,
  credentials: Credentials,
): Effect.Effect<void, LocalCommandFailure> => {
  const content = `${Object.entries(appVariables(app, credentials))
    .map(([key, value]: readonly [string, string]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
  return replacePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
};

const setup = Effect.fn("setup")(function* setup() {
  yield* fileIo(async () => mkdir(local, { mode: privateDirectoryMode, recursive: true }));
  yield* fileIo(async () =>
    mkdir(new URL("logs/", local), { mode: privateDirectoryMode, recursive: true }),
  );
  yield* refreshBrowserConfig();
  const credentials = yield* loadOrCreateCredentials();
  yield* Effect.forEach(applications, (app) => writeAppVariables(app, credentials));
  const report: SetupReport = {
    credentialsFile: fileURLToPath(credentialsFile),
    event: "local.app_configuration_ready",
    ok: true,
    secretsPrinted: false,
  };
  return report;
});

export { setup };
