// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, open, readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { applicationPorts, applications } from "@repo/config";

import type { LocalCommandFailure } from "./failure.ts";
import { fileIo } from "./failure.ts";
import { certificateAuthorityBase64, ensureGateway } from "./lan-gateway.ts";
import {
  lanOrigin,
  logFileUrl,
  readCredentials,
  readyPaths,
  root,
  routeNames,
  run,
  running,
  socket,
} from "./local-environment.ts";
import type { App } from "./local-environment.ts";
import { privateFileMode } from "./private-files.ts";

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

function httpStatus(app: App): Effect.Effect<number | null> {
  return Effect.tryPromise(async (signal) =>
    fetch(`http://127.0.0.1:${applicationPorts[app]}${readyPaths[app]}`, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(statusTimeoutMilliseconds)]),
    }),
  ).pipe(
    Effect.match({
      // oxlint-disable-next-line unicorn/no-null
      onFailure: () => null,
      onSuccess: (response) => response.status,
    }),
  );
}

function appStatus(app: App): Effect.Effect<AppStatus> {
  return Effect.all({ httpStatus: httpStatus(app), processRunning: running(app) }).pipe(
    Effect.map((observed) => ({
      app,
      logFile: fileURLToPath(logFileUrl(app)),
      origin: lanOrigin(app),
      ...observed,
    })),
  );
}

const status = Effect.fn("status")(function* status() {
  const report: StatusReport = {
    apps: yield* Effect.forEach(applications, appStatus, { concurrency: "unbounded" }),
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
  const log = fileURLToPath(logFileUrl(app));
  yield* Effect.acquireUseRelease(
    fileIo(async () => open(log, "a", privateFileMode)),
    () => Effect.void,
    (file) => fileIo(async () => file.close()),
  );
  yield* fileIo(async () => chmod(log, privateFileMode));
  const vp = JSON.stringify(path.join(root, "node_modules/.bin/vp"));
  const command = `exec ${vp} run --filter @repo/${app} preview >> ${JSON.stringify(log)} 2>&1`;
  return yield* run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
});

const start = Effect.fn("start")(function* start(app: App) {
  yield* readCredentials();
  yield* ensureGateway();
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

function logs(app: App): Effect.Effect<{ app: App; log: string }, LocalCommandFailure> {
  return fileIo(async () => readFile(logFileUrl(app), "utf-8")).pipe(
    Effect.map((log) => ({ app, log })),
  );
}

export { connection, logs, start, status, stop };
