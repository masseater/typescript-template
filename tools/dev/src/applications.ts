import {
  apps,
  credentialsFile,
  lanOrigin,
  logFileUrl,
  origins,
  ports,
  readCredentials,
  readyPaths,
  root,
  run,
  running,
  socket,
} from "./local-environment.ts";
import { certificateAuthorityBase64, ensureGateway } from "./lan-gateway.ts";
import { chmod, open, readFile } from "node:fs/promises";
import type { App } from "./local-environment.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { privateFileMode } from "./private-files.ts";

interface ApplicationStatus {
  readonly app: App;
  readonly httpStatus: number | null;
  readonly logFile: string;
  readonly origin: string;
  readonly processRunning: boolean;
}

interface StatusReport {
  readonly apps: readonly ApplicationStatus[];
  readonly event: "local.application_status";
  readonly functionalVerification: "not-proven-by-status";
}

interface ConnectionReport {
  readonly admin: string;
  readonly adminCredentialsFile: string;
  readonly event: "local.lan_access";
  readonly grafana: string;
  readonly mailpit: string;
  readonly reachableFrom: "devices on the same LAN that trust the local certificate authority";
  readonly user: string;
  readonly wiki: string;
  readonly windowsTrustCommand: string;
}

interface LogReport {
  readonly app: App;
  readonly log: string;
}

const statusTimeoutMilliseconds = 3000;

async function httpStatus(app: App): Promise<number | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${ports[app]}${readyPaths[app]}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(statusTimeoutMilliseconds),
    });
    return response.status;
  } catch {
    return null;
  }
}

async function status(): Promise<StatusReport> {
  const reports = apps.map(async (app): Promise<ApplicationStatus> => {
    const processRunning = await running(app);
    return {
      app,
      httpStatus: await httpStatus(app),
      logFile: fileURLToPath(logFileUrl(app)),
      origin: origins[app],
      processRunning,
    };
  });
  return {
    apps: await Promise.all(reports),
    event: "local.application_status",
    functionalVerification: "not-proven-by-status",
  };
}

function windowsTrustCommand(certificate: string): string {
  return `$p = Join-Path $env:TEMP 'template-local-ca.cer'; [IO.File]::WriteAllBytes($p, [Convert]::FromBase64String('${certificate}')); Import-Certificate -FilePath $p -CertStoreLocation Cert:\\CurrentUser\\Root`;
}

async function connection(): Promise<ConnectionReport> {
  await ensureGateway();
  return {
    admin: origins.admin,
    adminCredentialsFile: fileURLToPath(credentialsFile),
    event: "local.lan_access",
    grafana: lanOrigin("grafana"),
    mailpit: lanOrigin("mailpit"),
    reachableFrom: "devices on the same LAN that trust the local certificate authority",
    user: origins.user,
    wiki: origins.wiki,
    windowsTrustCommand: windowsTrustCommand(await certificateAuthorityBase64()),
  };
}

async function launch(app: App): Promise<void> {
  const log = fileURLToPath(logFileUrl(app));
  const logFile = await open(log, "a", privateFileMode);
  await logFile.close();
  await chmod(log, privateFileMode);
  const vitePlus = JSON.stringify(path.join(root, "node_modules/.bin/vp"));
  const command = `exec ${vitePlus} run --filter @template/${app} preview >> ${JSON.stringify(log)} 2>&1`;
  await run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
}

async function start(app: App): Promise<StatusReport> {
  await readCredentials();
  await ensureGateway();
  if (!(await running(app))) {
    await launch(app);
  }
  return status();
}

async function stop(app: App): Promise<StatusReport> {
  if (await running(app)) {
    await run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  }
  return status();
}

async function logs(app: App): Promise<LogReport> {
  return { app, log: await readFile(logFileUrl(app), "utf-8") };
}

export { connection, logs, start, status, stop };
