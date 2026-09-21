import { applications } from "@repo/config";
import { Crypto, Effect, FileSystem, Path, PlatformError, Schema } from "effect";

import { failure } from "./failure.ts";
import {
  OriginMode,
  credentialsFile,
  local,
  readCredentials,
  refreshBrowserConfig,
} from "./local-environment.ts";
import { isNotFound, urlPath, withFileSystem } from "./platform.ts";
import { privateDirectoryMode, replacePrivateFile, writePrivateFile } from "./private-files.ts";
import { appVariables, sharedRunnerCredentials } from "./shared-runner-credentials.ts";

import type { LocalCommandFailure } from "./failure.ts";
import type { App, Credentials } from "./local-environment.ts";

interface SetupReport {
  readonly credentialsFile: string;
  readonly event: "local.app_configuration_ready";
  readonly ok: true;
  readonly origins: typeof OriginMode.Type;
  readonly secretsPrinted: false;
  readonly stripeTestKeys: boolean;
}

const authSecretBytes = 48;
const jsonIndentation = 2;

function credentialsExist(): Effect.Effect<
  boolean,
  LocalCommandFailure,
  FileSystem.FileSystem | Path.Path
> {
  return urlPath(credentialsFile).pipe(
    Effect.flatMap((path) =>
      FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.stat(path)),
        Effect.as(true),
        Effect.catchIf(
          (error): error is PlatformError.PlatformError => isNotFound(error),
          () => Effect.succeed(false),
        ),
      ),
    ),
  );
}

const loadOrCreateCredentials = Effect.fn("loadOrCreateCredentials")(
  function* loadOrCreateCredentials() {
    if (!(yield* credentialsExist())) {
      const bytes = yield* Crypto.Crypto.pipe(
        Effect.flatMap((crypto) => crypto.randomBytes(authSecretBytes)),
        Effect.mapError(() => failure("file_io_failed")),
      );
      const authSecret = Buffer.from(bytes).toString("base64url");
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
): Effect.Effect<void, LocalCommandFailure, FileSystem.FileSystem | Path.Path> {
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
  const localPath = yield* urlPath(local);
  yield* withFileSystem((fs) =>
    fs.makeDirectory(localPath, { mode: privateDirectoryMode, recursive: true }),
  );
  const logsPath = yield* urlPath(new URL("logs/", local));
  yield* withFileSystem((fs) =>
    fs.makeDirectory(logsPath, { mode: privateDirectoryMode, recursive: true }),
  );
  yield* refreshBrowserConfig();
  const credentials =
    "CI" in process.env ? sharedRunnerCredentials() : yield* rememberOrigins(args);
  yield* Effect.forEach(applications, (app) =>
    writeAppVariables(app, credentials, credentials.origins),
  );
  const report: SetupReport = {
    credentialsFile: yield* urlPath(credentialsFile),
    event: "local.app_configuration_ready",
    ok: true,
    origins: credentials.origins,
    secretsPrinted: false,
    stripeTestKeys: credentials.stripe !== undefined,
  };
  return report;
});

export { setup };
