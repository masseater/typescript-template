import { createHash, createPublicKey } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { loopbackAddress } from "@repo/config";
import { Effect } from "effect";

import { failure, fileIo } from "./failure.ts";
import { local, root, routeNames, routes, run, running, socket } from "./local-environment.ts";
import { privateDirectoryMode } from "./private-files.ts";

import type { LocalCommandFailure } from "./failure.ts";

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

const browserLaunchArguments = Effect.fn("browserLaunchArguments")(
  function* browserLaunchArguments() {
    const certificate = yield* fileIo(async () => readFile(certificateAuthority, "utf-8"));
    const authority = yield* Effect.try({
      catch: () => failure("file_io_failed"),
      try: () => createPublicKey(certificate),
    });
    const pin = createHash("sha256")
      .update(authority.export({ format: "der", type: "spki" }))
      .digest("base64");
    return [
      "--args",
      `--ignore-certificate-errors-spki-list=${pin},--host-resolver-rules=MAP template-*.local ${loopbackAddress}`,
    ];
  },
);

function launchGateway(): Effect.Effect<unknown, LocalCommandFailure> {
  const log = fileURLToPath(new URL("logs/gateway.log", local));
  const gateway = JSON.stringify(fileURLToPath(new URL("gateway.ts", import.meta.url)));
  const command = `exec node ${gateway} ${proxyPort} >> ${JSON.stringify(log)} 2>&1`;
  return run(
    "tmux",
    ["-L", socket, "new-session", "-d", "-s", gatewaySession, "-c", root, "fish", "-c", command],
    { cwd: root },
  );
}

const ensureGateway = Effect.fn("ensureGateway")(function* ensureGateway() {
  yield* fileIo(async () => mkdir(portlessHome, { mode: privateDirectoryMode, recursive: true }));
  yield* run(portless, ["proxy", "start", "--lan", "--port", String(proxyPort)], {
    cwd: root,
    env: portlessEnvironment,
    timeout: proxyStartTimeoutMilliseconds,
  });
  yield* Effect.forEach(routeNames, (name) =>
    run(portless, ["alias", `template-${name}`, String(routes[name]), "--force"], {
      cwd: root,
      env: portlessEnvironment,
      timeout: aliasTimeoutMilliseconds,
    }),
  );
  if (!(yield* running(gatewaySession))) {
    yield* launchGateway();
  }
});

function certificateAuthorityBase64(): Effect.Effect<string, LocalCommandFailure> {
  return fileIo(async () => readFile(certificateAuthority)).pipe(
    Effect.map((certificate) => certificate.toString("base64")),
  );
}

export { browserLaunchArguments, certificateAuthorityBase64, ensureGateway };
