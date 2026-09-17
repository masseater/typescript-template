import { assertOwnerOnly, privateDirectoryMode, replacePrivateFile } from "./private-files.ts";
import { chmod, lstat, mkdir, readFile } from "node:fs/promises";
import { literal, minLength, parse, picklist, pipe, strictObject, string } from "valibot";
import type { InferOutput } from "valibot";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootHashLength = 12;
const rootHash = createHash("sha256").update(root).digest("hex").slice(0, rootHashLength);
const socket = `template-${rootHash}`;
const apps = ["user", "admin", "wiki"] as const;
const appSchema = picklist(apps);
const adminPasswordMinimumLength = 24;
const authSecretMinimumLength = 32;
const credentialSchema = strictObject({
  adminPassword: pipe(string(), minLength(adminPasswordMinimumLength)),
  adminUser: literal("operator"),
  authSecret: pipe(string(), minLength(authSecretMinimumLength)),
});
const ports = { admin: 3002, user: 3001, wiki: 3003 };
const routes = { ...ports, grafana: 3100, mailpit: 8025 };
const routeNames = ["user", "admin", "wiki", "grafana", "mailpit"] as const;
const readyPaths = { admin: "/login", user: "/login", wiki: "/" };

type App = (typeof apps)[number];
type RouteName = (typeof routeNames)[number];
type Credentials = InferOutput<typeof credentialSchema>;

function lanHostname(name: RouteName): string {
  return `template-${name}.local`;
}

function lanOrigin(name: RouteName): string {
  return `https://${lanHostname(name)}`;
}

const origins = {
  admin: lanOrigin("admin"),
  user: lanOrigin("user"),
  wiki: lanOrigin("wiki"),
};
const browserSettings = `${JSON.stringify({
  allowedDomains: ["localhost", "127.0.0.1", ...routeNames.map((name) => lanHostname(name))],
  restoreSave: "never",
})}\n`;

function logFileUrl(name: string): URL {
  return new URL(`logs/${name}.log`, local);
}

async function running(session: string): Promise<boolean> {
  try {
    await run("tmux", ["-L", socket, "has-session", "-t", session], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

async function readCredentials(): Promise<Credentials> {
  await assertOwnerOnly(credentialsFile);
  return parse(credentialSchema, JSON.parse(await readFile(credentialsFile, "utf-8")) as unknown);
}

async function browserSocketDirectory(): Promise<string> {
  const directory = path.join(tmpdir(), `ab-${rootHash}`);
  await mkdir(directory, { mode: privateDirectoryMode, recursive: true });
  const entry = await lstat(directory);
  if (!entry.isDirectory() || entry.uid !== process.getuid?.()) {
    throw new Error("Browser socket directory must be a directory owned by the current user");
  }
  await chmod(directory, privateDirectoryMode);
  return directory;
}

async function refreshBrowserConfig(): Promise<string> {
  const directory = await browserSocketDirectory();
  await replacePrivateFile(browserConfig, browserSettings);
  return directory;
}

export {
  appSchema,
  apps,
  browserConfig,
  browserSocketDirectory,
  credentialsFile,
  lanOrigin,
  local,
  logFileUrl,
  origins,
  ports,
  readCredentials,
  readyPaths,
  refreshBrowserConfig,
  root,
  routeNames,
  routes,
  run,
  running,
  socket,
};
export type { App, Credentials };
