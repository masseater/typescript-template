import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as v from "valibot";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const browserSocket = new URL("ab/", local);
const socket = `template-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`;
const appSchema = v.picklist(["user", "admin"]);
const credentialSchema = v.strictObject({
  authSecret: v.pipe(v.string(), v.minLength(32)),
  adminUser: v.literal("operator"),
  adminPassword: v.pipe(v.string(), v.minLength(24)),
});
const origins = { user: "http://localhost:3001", admin: "http://localhost:3002" };

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

async function setup() {
  await mkdir(local, { recursive: true, mode: 0o700 });
  await mkdir(new URL("logs/", local), { recursive: true, mode: 0o700 });
  await mkdir(browserSocket, { recursive: true, mode: 0o700 });
  await writePrivateFile(
    browserConfig,
    `${JSON.stringify({ allowedDomains: ["localhost", "127.0.0.1"], restoreSave: "never" })}\n`,
  );
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
  for (const app of ["user", "admin"] as const) {
    const values = {
      APP_ORIGIN: origins[app],
      AUTH_SECRET: credentials.authSecret,
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      EMAIL_FROM: "no-reply@example.test",
      MAILPIT_URL: "http://127.0.0.1:8025",
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
    await writePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
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
  const apps = await Promise.all(
    (["user", "admin"] as const).map(async (app) => {
      const live = await running(app);
      const response = await fetch(`${origins[app]}/login`, {
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
    apps,
  };
}

function connection(destination: string | undefined) {
  const target = v.parse(
    v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$/)),
    destination,
  );
  return {
    event: "local.connection_instructions",
    mainComputerCommand: `ssh -N -o ExitOnForwardFailure=yes -L 3001:localhost:3001 -L 3002:localhost:3002 -L 3100:localhost:3100 -L 8025:localhost:8025 ${target}`,
    user: origins.user,
    admin: origins.admin,
    grafana: "http://localhost:3100",
    mailpit: "http://localhost:8025",
    adminCredentialsFile: fileURLToPath(credentialsFile),
    passkeyOrigin: "localhost; use the forwarded URLs without replacing the hostname with a LAN IP",
    mainComputerVerification: "must-be-performed-on-the-main-computer",
  };
}

async function start(app: "user" | "admin") {
  await readCredentials();
  if (!(await running(app))) {
    const log = fileURLToPath(new URL(`logs/${app}.log`, local));
    const logFile = await open(log, "a", 0o600);
    await logFile.close();
    await chmod(log, 0o600);
    const command = `exec pnpm --filter @template/${app} run preview >> ${JSON.stringify(log)} 2>&1`;
    await run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", app, "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  }
  return status();
}

async function stop(app: "user" | "admin") {
  if (await running(app))
    await run("tmux", ["-L", socket, "kill-session", "-t", app], { cwd: root });
  return status();
}

async function browser(app: "user" | "admin") {
  await mkdir(browserSocket, { recursive: true, mode: 0o700 });
  await writePrivateFile(
    browserConfig,
    `${JSON.stringify({ allowedDomains: ["localhost", "127.0.0.1"], restoreSave: "never" })}\n`,
  );
  const session = `template-local-${app}`;
  const args = ["--config", fileURLToPath(browserConfig), "--session", session];
  const env = { ...process.env, AGENT_BROWSER_SOCKET_DIR: fileURLToPath(browserSocket) };
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
  await run("agent-browser", [...args, "open", `${origins[app]}/login`], {
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

async function browserCommand(app: "user" | "admin", args: string[]) {
  if (args.length === 0) throw new Error("A browser command is required");
  const child = spawn(
    "agent-browser",
    ["--config", fileURLToPath(browserConfig), "--session", `template-local-${app}`, ...args],
    {
      cwd: root,
      env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: fileURLToPath(browserSocket) },
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
  else if (action === "connect") console.log(JSON.stringify(connection(process.argv[3])));
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
        "Check pnpm dev:setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
    }),
  );
  process.exitCode = 1;
}
