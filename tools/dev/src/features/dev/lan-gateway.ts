import { loopbackAddress } from "@repo/config";
import { Crypto, Effect, FileSystem, Path, Schema } from "effect";

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

function derSpan(
  bytes: Uint8Array,
  offset: number,
): { readonly header: number; readonly length: number } {
  const first = bytes[offset + 1];
  if (first === undefined) {
    throw new Error("truncated");
  }
  if (first < 0x80) {
    return { header: 2, length: first };
  }
  const size = first & 0x7f;
  let length = 0;
  for (let index = 0; index < size; index += 1) {
    const octet = bytes[offset + 2 + index];
    if (octet === undefined) {
      throw new Error("truncated");
    }
    length = (length << 8) | octet;
  }
  return { header: 2 + size, length };
}

function derChildren(bytes: Uint8Array, offset: number): readonly (readonly [number, number])[] {
  const span = derSpan(bytes, offset);
  const end = offset + span.header + span.length;
  const children: Array<readonly [number, number]> = [];
  let cursor = offset + span.header;
  while (cursor < end) {
    const child = derSpan(bytes, cursor);
    const childEnd = cursor + child.header + child.length;
    children.push([cursor, childEnd]);
    cursor = childEnd;
  }
  return children;
}

function spkiFromCertificatePem(pem: string): Uint8Array {
  const der = Buffer.from(
    pem
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replaceAll(/\s/gu, ""),
    "base64",
  );
  const [tbs] = derChildren(der, 0);
  if (tbs === undefined) {
    throw new Error("certificate");
  }
  const fields = derChildren(der, tbs[0]);
  const first = der[fields[0]?.[0] ?? -1];
  const spki = fields[first === 0xa0 ? 6 : 5];
  if (spki === undefined) {
    throw new Error("spki");
  }
  return der.subarray(spki[0], spki[1]);
}

const browserLaunchArguments = Effect.fn("browserLaunchArguments")(
  function* browserLaunchArguments() {
    const certificatePath = yield* urlPath(certificateAuthority);
    const certificate = yield* withFileSystem((fs) => fs.readFileString(certificatePath));
    const spki = yield* Effect.try({
      catch: () => failure("file_io_failed"),
      try: () => spkiFromCertificatePem(certificate),
    });
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

function launchGateway() {
  return Effect.gen(function* launch() {
    const logPath = yield* urlPath(new URL("logs/gateway.log", local));
    const gatewayPath = yield* urlPath(new URL("gateway.ts", import.meta.url));
    const log = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.String))(logPath).pipe(
      Effect.orDie,
    );
    const gateway = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.String))(
      gatewayPath,
    ).pipe(Effect.orDie);
    const command = `exec node ${gateway} ${proxyPort} >> ${log} 2>&1`;
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
    ...process.env,
    PORTLESS_STATE_DIR: portlessHomePath,
    PORTLESS_SYNC_HOSTS: "0",
  };
  yield* withFileSystem((fs) =>
    fs.makeDirectory(portlessHomePath, { mode: privateDirectoryMode, recursive: true }),
  );
  const portless = yield* urlPath(new URL("../../../node_modules/.bin/portless", import.meta.url));
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
