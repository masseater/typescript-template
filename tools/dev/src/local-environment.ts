import { assertOwnerOnly, privateDirectoryMode, replacePrivateFile } from "./private-files.ts";
import { chmod, lstat, mkdir, readFile } from "node:fs/promises";
import {
  literal,
  minLength,
  object,
  parse,
  picklist,
  pipe,
  safeParse,
  strictObject,
  string,
} from "valibot";
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
const servicePorts = { grafana: 3100, mailpit: 8025 };
const readyPaths = { admin: "/login", user: "/login", wiki: "/" };
const tailscaleTimeoutMilliseconds = 20_000;
const tailnetSchema = object({
  BackendState: string(),
  Self: object({ DNSName: string() }),
});

type App = (typeof apps)[number];
type Credentials = InferOutput<typeof credentialSchema>;

async function tailscaleStatus(): Promise<string> {
  try {
    const { stdout } = await run("tailscale", ["status", "--json"], { cwd: root });
    return stdout;
  } catch {
    return "";
  }
}

async function tailnetHost(): Promise<string | undefined> {
  const output = await tailscaleStatus();
  if (output === "") {
    return undefined;
  }
  const parsed = safeParse(tailnetSchema, JSON.parse(output) as unknown);
  if (!parsed.success || parsed.output.BackendState !== "Running") {
    return undefined;
  }
  const tailnetName = parsed.output.Self.DNSName.replace(/\.$/u, "");
  return /^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/u.test(tailnetName) ? tailnetName : undefined;
}

const host = await tailnetHost();

function originFor(port: number): string {
  return host === undefined ? `http://localhost:${port}` : `https://${host}:${port}`;
}

const origins = {
  admin: originFor(ports.admin),
  user: originFor(ports.user),
  wiki: originFor(ports.wiki),
};
const browserSettings = `${JSON.stringify({
  allowedDomains: ["localhost", "127.0.0.1", ...(host === undefined ? [] : [host])],
  restoreSave: "never",
})}\n`;

function logFileUrl(app: App): URL {
  return new URL(`logs/${app}.log`, local);
}

async function publish(port: number, enabled: boolean): Promise<void> {
  if (host === undefined) {
    return;
  }
  await run(
    "tailscale",
    enabled
      ? ["serve", "--bg", `--https=${port}`, `http://127.0.0.1:${port}`]
      : ["serve", `--https=${port}`, "off"],
    { cwd: root, timeout: tailscaleTimeoutMilliseconds },
  );
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
  host,
  local,
  logFileUrl,
  originFor,
  origins,
  ports,
  publish,
  readCredentials,
  readyPaths,
  refreshBrowserConfig,
  root,
  run,
  servicePorts,
  socket,
};
export type { App, Credentials };
