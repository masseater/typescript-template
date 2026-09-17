import { createHash, createPublicKey } from "node:crypto";
import {
  local,
  logFileUrl,
  root,
  routeNames,
  routes,
  run,
  running,
  socket,
} from "./local-environment.ts";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { privateDirectoryMode } from "./private-files.ts";

const proxyPort = 1355;
const proxyStartTimeoutMilliseconds = 60_000;
const aliasTimeoutMilliseconds = 30_000;
const gatewaySession = "gateway";
const portlessHome = new URL("portless/", local);
const certificateAuthority = new URL("ca.pem", portlessHome);
const portless = fileURLToPath(new URL("../node_modules/.bin/portless", import.meta.url));
const portlessEnvironment = {
  ...process.env,
  PORTLESS_STATE_DIR: fileURLToPath(portlessHome),
  PORTLESS_SYNC_HOSTS: "0",
};

async function browserLaunchArguments(): Promise<string[]> {
  const authority = createPublicKey(await readFile(certificateAuthority, "utf-8"));
  const pin = createHash("sha256")
    .update(authority.export({ format: "der", type: "spki" }))
    .digest("base64");
  return [
    "--args",
    `--ignore-certificate-errors-spki-list=${pin},--host-resolver-rules=MAP template-*.local 127.0.0.1`,
  ];
}

async function launchGateway(): Promise<void> {
  const log = fileURLToPath(logFileUrl(gatewaySession));
  const entry = fileURLToPath(new URL("gateway.ts", import.meta.url));
  const command = `exec node ${JSON.stringify(entry)} ${proxyPort} >> ${JSON.stringify(log)} 2>&1`;
  await run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", gatewaySession, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
}

async function ensureGateway(): Promise<void> {
  await mkdir(portlessHome, { mode: privateDirectoryMode, recursive: true });
  await run(portless, ["proxy", "start", "--lan", "--port", String(proxyPort)], {
    cwd: root,
    env: portlessEnvironment,
    timeout: proxyStartTimeoutMilliseconds,
  });
  for (const name of routeNames) {
    await run(portless, ["alias", `template-${name}`, String(routes[name]), "--force"], {
      cwd: root,
      env: portlessEnvironment,
      timeout: aliasTimeoutMilliseconds,
    });
  }
  if (!(await running(gatewaySession))) {
    await launchGateway();
  }
}

async function certificateAuthorityBase64(): Promise<string> {
  const certificate = await readFile(certificateAuthority);
  return certificate.toString("base64");
}

export { browserLaunchArguments, certificateAuthorityBase64, ensureGateway };
