import { Clock, Effect, Encoding, Redacted, Result, Schema } from "effect";

import { gitHubRequest } from "./github-request.ts";
import { WikiPublishKeyInvalid } from "./wiki-publish-key-invalid.ts";

import type { WikiPublishConfig } from "@repo/config";

const jwtClockSkewSeconds = 60;
const jwtLifetimeSeconds = 540;
const millisecondsPerSecond = 1000;
const derShortLengthLimit = 0x80;
const byteMask = 0xff;
const rsaEncryptionAlgorithm = Uint8Array.of(
  0x30,
  0x0d,
  0x06,
  0x09,
  0x2a,
  0x86,
  0x48,
  0x86,
  0xf7,
  0x0d,
  0x01,
  0x01,
  0x01,
  0x05,
  0x00,
);
const pkcs8Version = Uint8Array.of(0x02, 0x01, 0x00);
const derTag = { octetString: 0x04, sequence: 0x30 } as const;

const Installation = Schema.Struct({ id: Schema.Finite });
const InstallationToken = Schema.Struct({ token: Schema.String });

function derLength(length: number): Uint8Array {
  if (length < derShortLengthLimit) {
    return Uint8Array.of(length);
  }
  const bytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / (byteMask + 1))) {
    bytes.unshift(remaining % (byteMask + 1));
  }
  return Uint8Array.of(derShortLengthLimit | bytes.length, ...bytes);
}

function derElement(tag: number, ...contents: readonly Uint8Array[]): Uint8Array {
  const body = contents.flatMap((part) => [...part]);
  return Uint8Array.of(tag, ...derLength(body.length), ...body);
}

function pkcs8Key(pem: string): Effect.Effect<Uint8Array, WikiPublishKeyInvalid> {
  const body = pem.replaceAll(/-----(?:BEGIN|END) (?:RSA )?PRIVATE KEY-----|\s/gu, "");
  const decoded = Encoding.decodeBase64(body);
  if (Result.isFailure(decoded)) {
    return Effect.fail(new WikiPublishKeyInvalid({ cause: decoded.failure }));
  }
  return Effect.succeed(
    pem.includes("BEGIN RSA PRIVATE KEY")
      ? derElement(
          derTag.sequence,
          pkcs8Version,
          rsaEncryptionAlgorithm,
          derElement(derTag.octetString, decoded.success),
        )
      : decoded.success,
  );
}

const base64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes);
const jsonSegment = (value: unknown): string =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

const appJwt = Effect.fn("signGitHubAppJwt")(function* appJwt(config: WikiPublishConfig) {
  const key = yield* pkcs8Key(Redacted.value(config.privateKey));
  const signingKey = yield* Effect.tryPromise({
    catch: (cause) => new WikiPublishKeyInvalid({ cause }),
    try: () =>
      crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(key),
        { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
        false,
        ["sign"],
      ),
  });
  const now = Math.floor((yield* Clock.currentTimeMillis) / millisecondsPerSecond);
  const unsigned = `${jsonSegment({ alg: "RS256", typ: "JWT" })}.${jsonSegment({
    exp: now + jwtLifetimeSeconds,
    iat: now - jwtClockSkewSeconds,
    iss: config.appId,
  })}`;
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, new TextEncoder().encode(unsigned)),
  );
  return Redacted.make(`${unsigned}.${base64Url(new Uint8Array(signature))}`);
});

const installationToken = Effect.fn("gitHubInstallationToken")(function* installationToken(
  config: WikiPublishConfig,
) {
  const jwt = yield* appJwt(config);
  const installation = yield* gitHubRequest(Installation, {
    method: "GET",
    path: `/repos/${config.owner}/${config.repository}/installation`,
    step: "installation",
    token: jwt,
  });
  const issued = yield* gitHubRequest(InstallationToken, {
    body: {
      permissions: { contents: "write", pull_requests: "write" },
      repositories: [config.repository],
    },
    method: "POST",
    path: `/app/installations/${String(installation.id)}/access_tokens`,
    step: "installation-token",
    token: jwt,
  });
  return Redacted.make(issued.token);
});

export { installationToken, pkcs8Key };
