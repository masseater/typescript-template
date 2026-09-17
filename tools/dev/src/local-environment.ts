import { applicationPorts, applications, loopbackHosts } from "@template/config";
import { assertOwnerOnly, privateDirectoryMode, replacePrivateFile } from "./private-files.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, lstat, mkdir, readFile } from "node:fs/promises";
import { minLength, object, parse, picklist, pipe, record, string } from "valibot";
import type { Application } from "@template/config";
import type { InferOutput } from "valibot";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const credentialsFile = new URL("runtime.json", local);
const browserConfig = new URL("browser.json", local);
const rootHashLength = 12;
const hexadecimalRadix = 16;
const hexadecimalByteLength = 2;
const rootDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(root));
const rootHash = Array.from(new Uint8Array(rootDigest), (byte) =>
  byte.toString(hexadecimalRadix).padStart(hexadecimalByteLength, "0"),
)
  .join("")
  .slice(0, rootHashLength);
// oxlint-disable-next-line node/no-process-env
const inheritedEnvironment = parse(record(string(), string()), process.env);
const socket = `template-${rootHash}`;
const apps = applications;
const appSchema = picklist(apps);
const authSecretMinimumLength = 32;
const credentialSchema = object({
  authSecret: pipe(string(), minLength(authSecretMinimumLength)),
});
const MAILPIT_PORT = 8025;
const ports = applicationPorts;
const routes = { ...ports, mailpit: MAILPIT_PORT };
const routeNames = [...applications, "mailpit"] as const;
const readyPaths = { admin: "/login", user: "/login", wiki: "/" };

type App = Application;
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
  allowedDomains: [...loopbackHosts, ...routeNames.map((name) => lanHostname(name))],
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
  const directory = `${tmpdir()}/ab-${rootHash}`;
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
  inheritedEnvironment,
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
