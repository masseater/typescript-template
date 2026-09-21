import { execFile, type ExecFileOptions } from "node:child_process";
import { chmod, lstat, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applicationPorts,
  applications,
  loopbackHosts,
  mailpitPort,
  minimumAuthSecretLength,
} from "@repo/config";
import { Effect, Schema } from "effect";

import { failure, fileIo } from "./failure.ts";
import { assertOwnerOnly, privateDirectoryMode, replacePrivateFile } from "./private-files.ts";

import type { Application } from "@repo/config";
import type { LocalCommandFailure } from "./failure.ts";

type App = Application;
type RouteName = App | "mailpit";

const ROOT_HASH_LENGTH = 12;

function execFileAsync(
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
): Promise<{ stderr: string | Buffer; stdout: string | Buffer }> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], options, (error, stdout, stderr) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve({ stderr, stdout });
    });
  });
}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(root));
const rootHash = Buffer.from(rootDigest).toString("hex").slice(0, ROOT_HASH_LENGTH);
const socket = `template-${rootHash}`;
const AppName = Schema.Literals(applications);
const OriginMode = Schema.Literals(["lan", "loopback"]);
const CredentialsFile = Schema.Struct({
  authSecret: Schema.String.check(Schema.isMinLength(minimumAuthSecretLength)),
  origins: Schema.optionalKey(OriginMode),
});
const routes = { ...applicationPorts, mailpit: mailpitPort };
const routeNames = [...applications, "mailpit"] as const;

type Credentials = typeof CredentialsFile.Type;

function lanHostname(name: RouteName): string {
  return `template-${name}.local`;
}

function lanOrigin(name: RouteName): string {
  return `https://${lanHostname(name)}`;
}

const browserSettings = `${JSON.stringify({
  allowedDomains: [...loopbackHosts, ...routeNames.map((name) => lanHostname(name))],
  restoreSave: "never",
})}\n`;

function logFileUrl(name: string): URL {
  return new URL(`logs/${name}.log`, local);
}

function run(
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
): Effect.Effect<unknown, LocalCommandFailure> {
  return Effect.tryPromise({
    catch: () => failure("process_failed"),
    try: async () => execFileAsync(file, args, options),
  });
}

function running(session: string): Effect.Effect<boolean> {
  return run("tmux", ["-L", socket, "has-session", "-t", session], { cwd: root }).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );
}

function application(value: string | undefined): Effect.Effect<App, LocalCommandFailure> {
  return Schema.decodeUnknownEffect(AppName)(value).pipe(
    Effect.mapError(() => failure("app_invalid")),
  );
}

const readCredentials = Effect.fn("readCredentials")(function* readCredentials() {
  yield* assertOwnerOnly(credentialsFile);
  const text = yield* fileIo(async () => readFile(credentialsFile, "utf-8"));
  const json = yield* Effect.try({
    catch: () => failure("credentials_invalid"),
    try: (): unknown => JSON.parse(text),
  });
  return yield* Schema.decodeUnknownEffect(CredentialsFile)(json).pipe(
    Effect.mapError(() => failure("credentials_invalid")),
  );
});

const browserSocketDirectory = Effect.fn("browserSocketDirectory")(
  function* browserSocketDirectory() {
    const directory = path.join(tmpdir(), `ab-${rootHash}`);
    yield* fileIo(async () => mkdir(directory, { mode: privateDirectoryMode, recursive: true }));
    const entry = yield* fileIo(async () => lstat(directory));
    if (!entry.isDirectory() || entry.uid !== process.getuid?.()) {
      return yield* failure("browser_socket_directory_invalid");
    }
    yield* fileIo(async () => chmod(directory, privateDirectoryMode));
    return directory;
  },
);

const refreshBrowserConfig = Effect.fn("refreshBrowserConfig")(function* refreshBrowserConfig() {
  const socketDirectory = yield* browserSocketDirectory();
  yield* replacePrivateFile(browserConfig, browserSettings);
  return socketDirectory;
});

export {
  application,
  browserConfig,
  credentialsFile,
  lanOrigin,
  local,
  logFileUrl,
  OriginMode,
  readCredentials,
  refreshBrowserConfig,
  root,
  routeNames,
  routes,
  run,
  running,
  socket,
};
export type { App, Credentials };
