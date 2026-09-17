import { access, lstat, mkdir, open } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { text } from "node:stream/consumers";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const GROUP_AND_OTHER_PERMISSIONS = 0o077;
const GENERATED_SECRET_BYTES = 32;
const FIRST_USER_ARGUMENT_INDEX = 2;

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const envFile = new URL("observability.env", local);
const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
const [action] = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
const actions: Readonly<Record<string, readonly string[]>> = {
  config: ["config", "--quiet"],
  logs: ["logs", "--no-color", "--tail", "100", "lgtm", "grafana-mcp"],
  mcp: [
    "run",
    "--rm",
    "-T",
    "grafana-mcp",
    "-t",
    "stdio",
    "--disable-write",
    "--enabled-tools",
    "search,datasource,prometheus,loki",
  ],
  status: ["ps", "--format", "json"],
  up: ["up", "-d", "--wait"],
};

async function tailscaleStatus(): Promise<string> {
  const child = spawn("tailscale", ["status", "--json"], { stdio: ["ignore", "pipe", "ignore"] });
  try {
    const [output] = await Promise.all([text(child.stdout), once(child, "close")]);
    return output;
  } catch {
    return "";
  }
}

function dnsName(status: unknown): string {
  if (typeof status !== "object" || status === null || !("Self" in status)) {
    return "";
  }
  const { Self: self } = status;
  if (
    typeof self !== "object" ||
    self === null ||
    !("DNSName" in self) ||
    typeof self.DNSName !== "string"
  ) {
    return "";
  }
  return self.DNSName.replace(/\.$/u, "");
}

async function tailnetHost(): Promise<string> {
  const output = await tailscaleStatus();
  try {
    const name = dnsName(JSON.parse(output));
    return /^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/u.test(name) ? name : "localhost";
  } catch {
    return "localhost";
  }
}

async function assertOwnerOnlyCredentials(): Promise<void> {
  const metadata = await lstat(envFile);
  if (!metadata.isFile() || (metadata.mode & GROUP_AND_OTHER_PERMISSIONS) !== 0) {
    throw new Error("Local credentials must be a regular file with mode 0600");
  }
}

function generatedSecret(): string {
  return randomBytes(GENERATED_SECRET_BYTES).toString("base64url");
}

async function writeCredentialsIfMissing(): Promise<void> {
  try {
    const handle = await open(envFile, "wx", OWNER_ONLY_FILE_MODE);
    try {
      await handle.writeFile(
        `GRAFANA_ADMIN_PASSWORD=${generatedSecret()}\nMCP_GRAFANA_SERVER_TOKEN=${generatedSecret()}\n`,
      );
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      throw error;
    }
  }
}

async function prepare(): Promise<void> {
  await mkdir(local, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true });
  await writeCredentialsIfMissing();
  await assertOwnerOnlyCredentials();
  process.stdout.write(
    `${JSON.stringify({ event: "local.observability_prepared", ok: true, secretsPrinted: false })}\n`,
  );
}

function composeArguments(name: string | undefined): readonly string[] {
  const args = name === undefined || !Object.hasOwn(actions, name) ? undefined : actions[name];
  if (args === undefined) {
    throw new Error("Unknown local observability action");
  }
  return args;
}

async function runCompose(args: readonly string[]): Promise<void> {
  await access(envFile, constants.R_OK);
  await assertOwnerOnlyCredentials();
  const bundled = await access(bundledCompose, constants.X_OK).then(
    () => true,
    () => false,
  );
  const child = spawn(
    bundled ? bundledCompose : "docker",
    [
      ...(bundled ? [] : ["compose"]),
      "--env-file",
      fileURLToPath(envFile),
      "-f",
      composeFile,
      ...args,
    ],
    {
      cwd: root,
      env: { ...process.env, MAILPIT_TAILNET_HOST: await tailnetHost() },
      stdio: "inherit",
    },
  );
  const exitArguments: unknown[] = await once(child, "exit");
  const [code] = exitArguments;
  if (code !== 0) {
    throw new Error("Compose command failed");
  }
}

async function runAction(name: string | undefined): Promise<void> {
  if (name === "prepare") {
    await prepare();
    return;
  }
  await runCompose(composeArguments(name));
}

try {
  await runAction(action);
} catch {
  process.stderr.write(
    `${JSON.stringify({
      event: "local.observability_command_failed",
      ok: false,
      remediation:
        "Run prepare:local, check root .local credentials permissions and the Docker daemon, then retry the requested action.",
    })}\n`,
  );
  process.exitCode = 1;
}
