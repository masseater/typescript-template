import {
  browserConfig,
  browserSocketDirectory,
  inheritedEnvironment,
  origins,
  readCredentials,
  readyPaths,
  refreshBrowserConfig,
  root,
  run,
} from "./local-environment.ts";
import type { App } from "./local-environment.ts";
import { browserLaunchArguments } from "./lan-gateway.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";

interface BrowserReport {
  readonly event: "local.browser_opened";
  readonly ok: true;
  readonly origin: string;
  readonly secretsPrinted: false;
  readonly session: string;
}

async function sessionArguments(app: App): Promise<string[]> {
  return [
    "--config",
    fileURLToPath(browserConfig),
    ...(await browserLaunchArguments()),
    "--session",
    `template-local-${app}`,
  ];
}

async function configureAdminCredentials(
  environment: Readonly<Record<string, string>>,
): Promise<void> {
  const credentials = await readCredentials();
  const child = spawn(
    "agent-browser",
    [...(await sessionArguments("admin")), "batch", "--bail", "--json"],
    {
      cwd: root,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  child.stdout.resume();
  child.stderr.resume();
  child.stdin.end(
    JSON.stringify([["set", "credentials", credentials.adminUser, credentials.adminPassword]]),
  );
  await once(child, "exit");
  if (child.exitCode !== 0) {
    throw new Error("Could not configure local browser authentication");
  }
}

async function browser(app: App): Promise<BrowserReport> {
  const socketDirectory = await refreshBrowserConfig();
  const environment = { ...inheritedEnvironment, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  if (app === "admin") {
    await configureAdminCredentials(environment);
  }
  await run(
    "agent-browser",
    [...(await sessionArguments(app)), "open", `${origins[app]}${readyPaths[app]}`],
    {
      cwd: root,
      env: environment,
    },
  );
  return {
    event: "local.browser_opened",
    ok: true,
    origin: origins[app],
    secretsPrinted: false,
    session: `template-local-${app}`,
  };
}

async function browserCommand(app: App, args: readonly string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("A browser command is required");
  }
  const socketDirectory = await browserSocketDirectory();
  const child = spawn("agent-browser", [...(await sessionArguments(app)), ...args], {
    cwd: root,
    env: { ...inheritedEnvironment, AGENT_BROWSER_SOCKET_DIR: socketDirectory },
    stdio: "inherit",
  });
  await once(child, "exit");
  if (child.exitCode !== 0) {
    process.exitCode = child.exitCode ?? 1;
  }
}

export { browser, browserCommand };
