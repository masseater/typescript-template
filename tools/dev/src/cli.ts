import { execFile, spawn } from "node:child_process";
import { createHash, createPublicKey, randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as v from "valibot";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootHash = createHash("sha256").update(root).digest("hex").slice(0, 12);
const socket = `template-${rootHash}`;
const apps = ["user", "admin", "wiki"] as const;
type App = (typeof apps)[number];
const appSchema = v.picklist(apps);
const credentialSchema = v.strictObject({
  authSecret: v.pipe(v.string(), v.minLength(32)),
  adminUser: v.literal("operator"),
  adminPassword: v.pipe(v.string(), v.minLength(24)),
});
const ports = { user: 3001, admin: 3002, wiki: 3003 };
const servicePorts = { mailpit: 8025 };
const routes = { ...ports, ...servicePorts };
const routeNames = ["user", "admin", "wiki", "mailpit"] as const;
const hostname = (name: (typeof routeNames)[number]) => `template-${name}.local`;
const origins = {
  user: `https://${hostname("user")}`,
  admin: `https://${hostname("admin")}`,
  wiki: `https://${hostname("wiki")}`,
};
const proxyPort = 1355;
const portlessHome = new URL("portless/", local);
const portless = fileURLToPath(new URL("../node_modules/.bin/portless", import.meta.url));
const portlessEnvironment = {
  ...process.env,
  PORTLESS_STATE_DIR: fileURLToPath(portlessHome),
  PORTLESS_SYNC_HOSTS: "0",
};
const browserSettings = `${JSON.stringify({
  allowedDomains: ["localhost", "127.0.0.1", ...routeNames.map((name) => hostname(name))],
  restoreSave: "never",
})}\n`;

async function browserLaunchArguments() {
  const authority = createPublicKey(await readFile(new URL("ca.pem", portlessHome), "utf8"));
  const pin = createHash("sha256")
    .update(authority.export({ type: "spki", format: "der" }))
    .digest("base64");
  return [
    "--args",
    `--ignore-certificate-errors-spki-list=${pin},--host-resolver-rules=MAP template-*.local 127.0.0.1`,
  ];
}

async function ensureGateway() {
  await mkdir(portlessHome, { recursive: true, mode: 0o700 });
  await run(portless, ["proxy", "start", "--lan", "--port", String(proxyPort)], {
    cwd: root,
    env: portlessEnvironment,
    timeout: 60_000,
  });
  for (const name of routeNames)
    await run(portless, ["alias", `template-${name}`, String(routes[name]), "--force"], {
      cwd: root,
      env: portlessEnvironment,
      timeout: 30_000,
    });
  if (!(await running("gateway"))) {
    const log = fileURLToPath(new URL("logs/gateway.log", local));
    const command = `exec node ${JSON.stringify(fileURLToPath(new URL("gateway.ts", import.meta.url)))} ${proxyPort} >> ${JSON.stringify(log)} 2>&1`;
    await run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", "gateway", "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  }
}

async function replacePrivateFile(path: URL, content: string) {
  const file = await open(path, "w", 0o600);
  try {
    await file.writeFile(content);
  } finally {
    await file.close();
  }
  await chmod(path, 0o600);
}

const readyPaths = { user: "/login", admin: "/login", wiki: "/" };

async function writePrivateFile(path: URL, content: string) {
  try {
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(content);
    } finally {
      await file.close();
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    if ((await readFile(path, "utf8")) !== content)
      throw new Error("Existing local configuration differs; it was preserved", { cause: error });
  }
  if (((await stat(path)).mode & 0o077) !== 0)
    throw new Error("Local credential file permissions must be 0600");
}

async function readCredentials() {
  if (((await stat(credentialsFile)).mode & 0o077) !== 0)
    throw new Error("Local credential file permissions must be 0600");
  return v.parse(credentialSchema, JSON.parse(await readFile(credentialsFile, "utf8")) as unknown);
}

async function browserSocketDirectory() {
  const directory = join(tmpdir(), `ab-${rootHash}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entry = await lstat(directory);
  if (!entry.isDirectory() || entry.uid !== process.getuid?.())
    throw new Error("Browser socket directory must be a directory owned by the current user");
  await chmod(directory, 0o700);
  return directory;
}

async function setup() {
  await mkdir(local, { recursive: true, mode: 0o700 });
  await mkdir(new URL("logs/", local), { recursive: true, mode: 0o700 });
  await browserSocketDirectory();
  await replacePrivateFile(browserConfig, browserSettings);
  const exists = await stat(credentialsFile).then(
    () => true,
    (error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
      throw error;
    },
  );
  const credentials = exists
    ? await readCredentials()
    : {
        authSecret: randomBytes(48).toString("base64url"),
        adminUser: "operator",
        adminPassword: randomBytes(32).toString("base64url"),
      };
  await writePrivateFile(credentialsFile, `${JSON.stringify(credentials, null, 2)}\n`);
  for (const app of apps) {
    const values = {
      APP_ORIGIN: origins[app],
      ...(app === "wiki"
        ? {}
        : {
            AUTH_SECRET: credentials.authSecret,
            EMAIL_FROM: "no-reply@example.test",
            MAILPIT_URL: "http://127.0.0.1:8025",
          }),
      ...(app === "admin"
        ? {
            LOCAL_ADMIN_USER: credentials.adminUser,
            LOCAL_ADMIN_PASSWORD: credentials.adminPassword,
          }
        : {}),
    };
    const content =
      Object.entries(values)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n") + "\n";
    await replacePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
  }
  return {
    ok: true,
    event: "local.app_configuration_ready",
    credentialsFile: fileURLToPath(credentialsFile),
    secretsPrinted: false,
  };
}

async function running(app: string) {
  return run("tmux", ["-L", socket, "has-session", "-t", app], { cwd: root }).then(
    () => true,
    () => false,
  );
}

async function status() {
  const results = await Promise.all(
    apps.map(async (app) => {
      const live = await running(app);
      const response = await fetch(`http://127.0.0.1:${ports[app]}${readyPaths[app]}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      }).then(
        (result) => result.status,
        () => null,
      );
      return {
        app,
        processRunning: live,
        httpStatus: response,
        origin: origins[app],
        logFile: fileURLToPath(new URL(`logs/${app}.log`, local)),
      };
    }),
  );
  return {
    event: "local.application_status",
    functionalVerification: "not-proven-by-status",
    apps: results,
  };
}

async function connection() {
  await ensureGateway();
  const certificate = await readFile(new URL("ca.pem", portlessHome));
  return {
    event: "local.lan_access",
    reachableFrom: "devices on the same LAN that trust the local certificate authority",
    user: origins.user,
    admin: origins.admin,
    wiki: origins.wiki,
    mailpit: `https://${hostname("mailpit")}`,
    adminCredentialsFile: fileURLToPath(credentialsFile),
    windowsTrustCommand: `$p = Join-Path $env:TEMP 'template-local-ca.cer'; [IO.File]::WriteAllBytes($p, [Convert]::FromBase64String('${certificate.toString("base64")}')); Import-Certificate -FilePath $p -CertStoreLocation Cert:\\CurrentUser\\Root`,
  };
}

async function start(app: App) {
  await readCredentials();
  await ensureGateway();
  if (!(await running(app))) {
    const log = fileURLToPath(new URL(`logs/${app}.log`, local));
    const logFile = await open(log, "a", 0o600);
    await logFile.close();
    await chmod(log, 0o600);
    const vp = JSON.stringify(join(root, "node_modules/.bin/vp"));
    const command = `exec ${vp} run --filter @template/${app} preview >> ${JSON.stringify(log)} 2>&1`;
    await run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  }
  return status();
}

async function stop(app: App) {
  if (await running(app))
    await run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  return status();
}

async function browser(app: App) {
  const socketDirectory = await browserSocketDirectory();
  await replacePrivateFile(browserConfig, browserSettings);
  const session = `template-local-${app}`;
  const args = [
    "--config",
    fileURLToPath(browserConfig),
    ...(await browserLaunchArguments()),
    "--session",
    session,
  ];
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory };
  if (app === "admin") {
    const credentials = await readCredentials();
    const child = spawn("agent-browser", [...args, "batch", "--bail", "--json"], {
      cwd: root,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdout.resume();
    child.stderr.resume();
    child.stdin.end(
      JSON.stringify([["set", "credentials", credentials.adminUser, credentials.adminPassword]]),
    );
    await new Promise<void>((resolve, reject) => {
      child.once("error", () => reject(new Error("Could not start agent-browser")));
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Could not configure local browser authentication"));
      });
    });
  }
  await run("agent-browser", [...args, "open", `${origins[app]}${readyPaths[app]}`], {
    cwd: root,
    env,
  });
  return {
    ok: true,
    event: "local.browser_opened",
    session,
    origin: origins[app],
    secretsPrinted: false,
  };
}

async function browserCommand(app: App, args: string[]) {
  if (args.length === 0) throw new Error("A browser command is required");
  const socketDirectory = await browserSocketDirectory();
  const child = spawn(
    "agent-browser",
    [
      "--config",
      fileURLToPath(browserConfig),
      ...(await browserLaunchArguments()),
      "--session",
      `template-local-${app}`,
      ...args,
    ],
    {
      cwd: root,
      env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDirectory },
      stdio: "inherit",
    },
  );
  await new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("Browser command could not start")));
    child.once("exit", (code) => {
      if (code !== 0) process.exitCode = code ?? 1;
      resolve();
    });
  });
}

try {
  const action = process.argv[2];
  if (action === "setup") console.log(JSON.stringify(await setup()));
  else if (action === "status") console.log(JSON.stringify(await status()));
  else if (action === "connect") console.log(JSON.stringify(await connection()));
  else {
    const app = v.parse(appSchema, process.argv[3]);
    if (action === "start") console.log(JSON.stringify(await start(app)));
    else if (action === "stop") console.log(JSON.stringify(await stop(app)));
    else if (action === "browser") console.log(JSON.stringify(await browser(app)));
    else if (action === "browser-command") await browserCommand(app, process.argv.slice(4));
    else if (action === "logs")
      console.log(
        JSON.stringify({ app, log: await readFile(new URL(`logs/${app}.log`, local), "utf8") }),
      );
    else throw new Error("Unsupported local application command");
  }
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      event: "local.application_command_failed",
      remediation:
        "Check vp run dev:setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
    }),
  );
  process.exitCode = 1;
}
