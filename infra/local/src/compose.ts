import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
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
  const actions: Record<string, string[]> = {
    config: ["config", "--quiet"],
    up: ["up", "-d", "--wait"],
    status: ["ps", "--format", "json"],
    logs: ["logs", "--no-color", "--tail", "100", "mailpit"],
  };
  if (!action || !Object.hasOwn(actions, action)) throw new Error("Unknown local service action");
  const args = actions[action];
  if (!args) throw new Error("Unknown local service action");
  const bundledCompose = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker-compose";
  const bundled = await access(bundledCompose, constants.X_OK).then(
    () => true,
    () => false,
  );
  const child = spawn(
    bundled ? bundledCompose : "docker",
    [...(bundled ? [] : ["compose"]), "-f", composeFile, ...args],
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
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      event: "local.services_command_failed",
      remediation: "Check the Docker daemon, then retry the requested action.",
    }),
  );
  process.exitCode = 1;
}
