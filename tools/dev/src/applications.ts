import {
  apps,
  credentialsFile,
  host,
  logFileUrl,
  originFor,
  origins,
  ports,
  publish,
  readCredentials,
  readyPaths,
  root,
  run,
  servicePorts,
  socket,
} from "./local-environment.ts";
import { chmod, open, readFile } from "node:fs/promises";
import type { App } from "./local-environment.ts";
import { fileURLToPath } from "node:url";
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
  readonly event: "local.remote_access";
  readonly grafana: string;
  readonly mailpit: string;
  readonly reachableFrom: "devices in the same tailnet";
  readonly user: string;
  readonly wiki: string;
}

interface LogReport {
  readonly app: App;
  readonly log: string;
}

const statusTimeoutMilliseconds = 3000;

async function running(app: App): Promise<boolean> {
  try {
    await run("tmux", ["-L", socket, "has-session", "-t", app], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

async function httpStatus(app: App): Promise<number | null> {
  try {
    const response = await fetch(`${origins[app]}${readyPaths[app]}`, {
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

async function connection(): Promise<ConnectionReport> {
  if (host === undefined) {
    throw new Error("Tailscale is required for access from other computers");
  }
  await publish(servicePorts.grafana, true);
  await publish(servicePorts.mailpit, true);
  return {
    admin: origins.admin,
    adminCredentialsFile: fileURLToPath(credentialsFile),
    event: "local.remote_access",
    grafana: originFor(servicePorts.grafana),
    mailpit: originFor(servicePorts.mailpit),
    reachableFrom: "devices in the same tailnet",
    user: origins.user,
    wiki: origins.wiki,
  };
}

async function launch(app: App): Promise<void> {
  const log = fileURLToPath(logFileUrl(app));
  const logFile = await open(log, "a", privateFileMode);
  await logFile.close();
  await chmod(log, privateFileMode);
  const command = `exec pnpm --filter @template/${app} run preview >> ${JSON.stringify(log)} 2>&1`;
  await run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
}

async function start(app: App): Promise<StatusReport> {
  await readCredentials();
  await publish(ports[app], true);
  if (!(await running(app))) {
    await launch(app);
  }
  return status();
}

async function stop(app: App): Promise<StatusReport> {
  if (await running(app)) {
    await run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  }
  await publish(ports[app], false);
  return status();
}

async function logs(app: App): Promise<LogReport> {
  return { app, log: await readFile(logFileUrl(app), "utf-8") };
}

export { connection, logs, start, status, stop };
