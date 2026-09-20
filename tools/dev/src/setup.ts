import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { applications } from "@repo/config";
import { Effect, Schema } from "effect";

import { failure, fileIo } from "./failure.ts";
import {
  OriginMode,
  credentialsFile,
  local,
  readCredentials,
  refreshBrowserConfig,
} from "./local-environment.ts";
import {
  isErrorCode,
  privateDirectoryMode,
  replacePrivateFile,
  writePrivateFile,
} from "./private-files.ts";
import { appVariables, sharedRunnerCredentials } from "./shared-runner-credentials.ts";

import type { LocalCommandFailure } from "./failure.ts";
import type { App, Credentials } from "./local-environment.ts";

interface SetupReport {
  readonly credentialsFile: string;
  readonly event: "local.app_configuration_ready";
  readonly ok: true;
  readonly origins: typeof OriginMode.Type;
  readonly secretsPrinted: false;
}

const authSecretBytes = 48;
const jsonIndentation = 2;

function credentialsExist(): Effect.Effect<boolean, LocalCommandFailure> {
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
}

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

function writeAppVariables(
  app: App,
  credentials: Credentials,
  mode: typeof OriginMode.Type,
): Effect.Effect<void, LocalCommandFailure> {
  const content = `${Object.entries(appVariables(app, credentials, mode))
    .map(([key, value]: readonly [string, string]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
  return replacePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
}

const rememberOrigins = Effect.fn("rememberOrigins")(function* rememberOrigins(
  args: readonly string[],
) {
  const stored = yield* loadOrCreateCredentials();
  const [requested = stored.origins ?? "lan"] = args;
  const origins = yield* Schema.decodeUnknownEffect(OriginMode)(requested).pipe(
    Effect.mapError(() => failure("origin_mode_invalid")),
  );
  const credentials = { ...stored, origins };
  if (stored.origins !== origins) {
    yield* replacePrivateFile(
      credentialsFile,
      `${JSON.stringify(credentials, undefined, jsonIndentation)}\n`,
    );
  }
  return credentials;
});

const setup = Effect.fn("setup")(function* setup(args: readonly string[]) {
  yield* fileIo(async () => mkdir(local, { mode: privateDirectoryMode, recursive: true }));
  yield* fileIo(async () =>
    mkdir(new URL("logs/", local), { mode: privateDirectoryMode, recursive: true }),
  );
  yield* refreshBrowserConfig();
  const credentials =
    "CI" in process.env ? sharedRunnerCredentials() : yield* rememberOrigins(args);
  yield* Effect.forEach(applications, (app) =>
    writeAppVariables(app, credentials, credentials.origins),
  );
  const report: SetupReport = {
    credentialsFile: fileURLToPath(credentialsFile),
    event: "local.app_configuration_ready",
    ok: true,
    origins: credentials.origins,
    secretsPrinted: false,
  };
  return report;
});

export { setup };
