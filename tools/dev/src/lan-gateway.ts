// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { createPublicKey } from "node:crypto";

import { loopbackAddress } from "@repo/config";
import { Crypto, Effect, FileSystem, Path } from "effect";

import { failure } from "./failure.ts";
import { local, root, routeNames, routes, run, running, socket } from "./local-environment.ts";
import { urlPath, withFileSystem } from "./platform.ts";
import { privateDirectoryMode } from "./private-files.ts";

import type { LocalCommandFailure } from "./failure.ts";

const proxyPort = 1355;
const proxyStartTimeoutMilliseconds = 60_000;
const aliasTimeoutMilliseconds = 30_000;
const gatewaySession = "gateway";
const portlessHome = new URL("portless/", local);
const certificateAuthority = new URL("ca.pem", portlessHome);

const browserLaunchArguments = Effect.fn("browserLaunchArguments")(
  function* browserLaunchArguments() {
    const certificatePath = yield* urlPath(certificateAuthority);
    const certificate = yield* withFileSystem((fs) => fs.readFileString(certificatePath));
    const authority = yield* Effect.try({
      catch: () => failure("file_io_failed"),
      try: () => createPublicKey(certificate),
    });
    const spki = new Uint8Array(authority.export({ format: "der", type: "spki" }));
    const pin = yield* Crypto.Crypto.pipe(
      Effect.flatMap((crypto) => crypto.digest("SHA-256", spki)),
      Effect.map((hash) => Buffer.from(hash).toString("base64")),
      Effect.mapError(() => failure("file_io_failed")),
    );
    return [
      "--args",
      `--ignore-certificate-errors-spki-list=${pin},--host-resolver-rules=MAP template-*.local ${loopbackAddress}`,
    ];
  },
);

function launchGateway(): Effect.Effect<unknown, LocalCommandFailure, Path.Path> {
  return Effect.gen(function* launch() {
    const log = yield* urlPath(new URL("logs/gateway.log", local));
    const gateway = JSON.stringify(yield* urlPath(new URL("gateway.ts", import.meta.url)));
    const command = `exec node ${gateway} ${proxyPort} >> ${JSON.stringify(log)} 2>&1`;
    return yield* run(
      "tmux",
      ["-L", socket, "new-session", "-d", "-s", gatewaySession, "-c", root, "fish", "-c", command],
      { cwd: root },
    );
  });
}

const ensureGateway = Effect.fn("ensureGateway")(function* ensureGateway() {
  const portlessHomePath = yield* urlPath(portlessHome);
  const portlessEnvironment = {
    // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
    ...process.env,
    PORTLESS_STATE_DIR: portlessHomePath,
    PORTLESS_SYNC_HOSTS: "0",
  };
  yield* withFileSystem((fs) =>
    fs.makeDirectory(portlessHomePath, { mode: privateDirectoryMode, recursive: true }),
  );
  const portless = yield* urlPath(new URL("../node_modules/.bin/portless", import.meta.url));
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

function certificateAuthorityBase64(): Effect.Effect<
  string,
  LocalCommandFailure,
  FileSystem.FileSystem | Path.Path
> {
  return urlPath(certificateAuthority).pipe(
    Effect.flatMap((path) => withFileSystem((fs) => fs.readFile(path))),
    Effect.map((certificate) => Buffer.from(certificate).toString("base64")),
  );
}

export { browserLaunchArguments, certificateAuthorityBase64, ensureGateway };
