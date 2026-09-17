import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, open, lstat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = new URL("../../../.local/", import.meta.url);
const envFile = new URL("observability.env", local);
const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const action = process.argv[2];

async function tailnetHost(): Promise<string> {
  const output = await new Promise<string>((resolve) => {
    const child = spawn("tailscale", ["status", "--json"], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.once("error", () => resolve(""));
    child.once("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
  try {
    const status: unknown = JSON.parse(output);
    const name =
      status &&
      typeof status === "object" &&
      "Self" in status &&
      status.Self &&
      typeof status.Self === "object" &&
      "DNSName" in status.Self &&
      typeof status.Self.DNSName === "string"
        ? status.Self.DNSName.replace(/\.$/, "")
        : "";
    return /^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/.test(name) ? name : "localhost";
  } catch {
    return "localhost";
  }
}

try {
  if (action === "prepare") {
    await mkdir(local, { recursive: true, mode: 0o700 });
    try {
      const handle = await open(envFile, "wx", 0o600);
      try {
        await handle.writeFile(
          `GRAFANA_ADMIN_PASSWORD=${randomBytes(32).toString("base64url")}\nMCP_GRAFANA_SERVER_TOKEN=${randomBytes(32).toString("base64url")}\n`,
        );
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    const metadata = await lstat(envFile);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
      throw new Error("Local credentials must be a regular file with mode 0600");
    console.info(
      JSON.stringify({ ok: true, event: "local.observability_prepared", secretsPrinted: false }),
    );
  } else {
    const actions: Record<string, string[]> = {
      config: ["config", "--quiet"],
      up: ["up", "-d", "--wait"],
      status: ["ps", "--format", "json"],
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
    };
    if (!action || !Object.hasOwn(actions, action))
      throw new Error("Unknown local observability action");
    const args = actions[action];
    if (!args) throw new Error("Unknown local observability action");
    await access(envFile, constants.R_OK);
    const metadata = await lstat(envFile);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
      throw new Error("Local credentials must be a regular file with mode 0600");
    const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
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
        stdio: "inherit",
        env: { ...process.env, MAILPIT_TAILNET_HOST: await tailnetHost() },
      },
    );
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Compose command failed"));
      });
    });
  }
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      event: "local.observability_command_failed",
      remediation:
        "Run prepare:local, check root .local credentials permissions and the Docker daemon, then retry the requested action.",
    }),
  );
  process.exitCode = 1;
}
