import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  applicationPorts,
  applications,
  loopbackHosts,
  mailpitPort,
  minimumAuthSecretLength,
} from "@repo/config";
import { Effect, Option, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { failure } from "./failure.ts";
import { urlPath, withFileSystem } from "./platform.ts";
import { assertOwnerOnly, privateDirectoryMode, replacePrivateFile } from "./private-files.ts";

import type { Application } from "@repo/config";
import type { LocalCommandFailure } from "./failure.ts";

type App = Application;
type RouteName = App | "mailpit";

interface RunOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly timeout?: number;
}

const ROOT_HASH_LENGTH = 12;

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(root));
const rootHash = Buffer.from(rootDigest).toString("hex").slice(0, ROOT_HASH_LENGTH);
const socket = `template-${rootHash}`;
const AppName = Schema.Literals(applications);
const OriginMode = Schema.Literals(["lan", "loopback"]);
const StripeTestCredentials = Schema.Struct({
  priceId: Schema.String.check(Schema.isPattern(/^price_[A-Za-z0-9]+$/u)),
  secretKey: Schema.String.check(Schema.isPattern(/^(?:sk|rk)_test_[A-Za-z0-9]+$/u)),
  webhookSecret: Schema.String.check(Schema.isPattern(/^whsec_[A-Za-z0-9]+$/u)),
});
const CredentialsFile = Schema.Struct({
  authSecret: Schema.String.check(Schema.isMinLength(minimumAuthSecretLength)),
  origins: Schema.optionalKey(OriginMode),
  stripe: Schema.optionalKey(StripeTestCredentials),
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
  options: RunOptions = {},
): Effect.Effect<unknown, LocalCommandFailure, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* runProgram() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const spawned = spawner.exitCode(
      ChildProcess.make(file, [...args], {
        cwd: options.cwd,
        env: options.env,
        extendEnv: true,
        stderr: "ignore",
        stdin: "ignore",
        stdout: "ignore",
      }),
    );
    const exitCode = yield* (
      options.timeout === undefined ? spawned : spawned.pipe(Effect.timeout(options.timeout))
    ).pipe(Effect.mapError(() => failure("process_failed")));
    if (exitCode !== 0) {
      return yield* failure("process_failed");
    }
  });
}

function running(
  session: string,
): Effect.Effect<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
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
  const path = yield* urlPath(credentialsFile);
  const text = yield* withFileSystem((fs) => fs.readFileString(path));
  return yield* Schema.decodeEffect(Schema.fromJsonString(CredentialsFile))(text).pipe(
    Effect.mapError(() => failure("credentials_invalid")),
  );
});

const browserSocketDirectory = Effect.fn("browserSocketDirectory")(
  function* browserSocketDirectory() {
    const path = yield* Path.Path;
    const directory = path.join(tmpdir(), `ab-${rootHash}`);
    yield* withFileSystem((fs) =>
      fs.makeDirectory(directory, { mode: privateDirectoryMode, recursive: true }),
    );
    const entry = yield* withFileSystem((fs) => fs.stat(directory));
    const uid = process.getuid?.();
    if (entry.type !== "Directory" || uid === undefined || !Option.contains(entry.uid, uid)) {
      return yield* failure("browser_socket_directory_invalid");
    }
    yield* withFileSystem((fs) => fs.chmod(directory, privateDirectoryMode));
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
