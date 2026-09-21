import { applicationOrigins, applicationReadyPaths, applications } from "@repo/config";
import { Effect, FileSystem, Path } from "effect";

import { certificateAuthorityBase64, ensureGateway } from "./lan-gateway.ts";
import {
  lanOrigin,
  logFileUrl,
  readCredentials,
  root,
  routeNames,
  run,
  running,
  socket,
} from "./local-environment.ts";
import { urlPath, withFileSystem, withPath } from "./platform.ts";
import { privateFileMode } from "./private-files.ts";

import type { LocalCommandFailure } from "./failure.ts";
import type { App } from "./local-environment.ts";

interface AppStatus {
  readonly app: App;
  readonly httpStatus: number | null;
  readonly logFile: string;
  readonly origin: string;
  readonly processRunning: boolean;
}

interface StatusReport {
  readonly apps: readonly AppStatus[];
  readonly event: "local.application_status";
  readonly functionalVerification: "not-proven-by-status";
}

const statusTimeoutMilliseconds = 3000;

function httpStatus(app: App, origin: string): Effect.Effect<number | null> {
  return Effect.tryPromise(async (signal) =>
    fetch(`${origin}${applicationReadyPaths[app]}`, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(statusTimeoutMilliseconds)]),
    }),
  ).pipe(
    Effect.match({
      // oxlint-disable-next-line unicorn/no-null -- a failed readiness probe is recorded as JSON null so the status event still carries the httpStatus field
      onFailure: () => null,
      onSuccess: (response) => response.status,
    }),
  );
}

function appOrigin(app: App, origins: "lan" | "loopback" | undefined): string {
  return origins === "loopback" ? applicationOrigins[app] : lanOrigin(app);
}

function appStatus(
  app: App,
  origins: "lan" | "loopback" | undefined,
): Effect.Effect<AppStatus, LocalCommandFailure, Path.Path> {
  const origin = appOrigin(app, origins);
  return Effect.all({ httpStatus: httpStatus(app, origin), processRunning: running(app) }).pipe(
    Effect.flatMap((observed) =>
      urlPath(logFileUrl(app)).pipe(
        Effect.map((logFile) => ({
          app,
          logFile,
          origin,
          ...observed,
        })),
      ),
    ),
  );
}

const status = Effect.fn("status")(function* status() {
  const credentials = yield* readCredentials();
  const report: StatusReport = {
    apps: yield* Effect.forEach(applications, (app) => appStatus(app, credentials.origins), {
      concurrency: "unbounded",
    }),
    event: "local.application_status",
    functionalVerification: "not-proven-by-status",
  };
  return report;
});

function windowsTrustCommand(certificate: string): string {
  return `$p = Join-Path $env:TEMP 'template-local-ca.cer'; [IO.File]::WriteAllBytes($p, [Convert]::FromBase64String('${certificate}')); Import-Certificate -FilePath $p -CertStoreLocation Cert:\\CurrentUser\\Root`;
}

const connection = Effect.fn("connection")(function* connection() {
  yield* ensureGateway();
  const certificate = yield* certificateAuthorityBase64();
  return {
    event: "local.lan_access",
    reachableFrom: "devices on the same LAN that trust the local certificate authority",
    ...Object.fromEntries(routeNames.map((name) => [name, lanOrigin(name)])),
    windowsTrustCommand: windowsTrustCommand(certificate),
  };
});

const launch = Effect.fn("launch")(function* launch(app: App) {
  const log = yield* urlPath(logFileUrl(app));
  yield* Effect.scoped(
    Effect.gen(function* touchLog() {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* fs.open(log, { flag: "a", mode: privateFileMode });
      yield* file.sync;
    }),
  );
  yield* withFileSystem((fs) => fs.chmod(log, privateFileMode));
  const vp = yield* withPath((path) =>
    Effect.succeed(JSON.stringify(path.join(root, "node_modules/.bin/vp"))),
  );
  const command = `exec ${vp} run --filter @repo/${app} preview >> ${JSON.stringify(log)} 2>&1`;
  return yield* run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
});

const start = Effect.fn("start")(function* start(app: App) {
  const credentials = yield* readCredentials();
  if (credentials.origins !== "loopback") {
    yield* ensureGateway();
  }
  if (!(yield* running(app))) {
    yield* launch(app);
  }
  return yield* status();
});

const stop = Effect.fn("stop")(function* stop(app: App) {
  if (yield* running(app)) {
    yield* run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  }
  return yield* status();
});

function logs(
  app: App,
): Effect.Effect<
  { app: App; log: string },
  LocalCommandFailure,
  FileSystem.FileSystem | Path.Path
> {
  return urlPath(logFileUrl(app)).pipe(
    Effect.flatMap((path) => withFileSystem((fs) => fs.readFileString(path))),
    Effect.map((log) => ({ app, log })),
  );
}

export { connection, logs, start, status, stop };
