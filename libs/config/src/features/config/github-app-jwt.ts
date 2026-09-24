import { Clock, Duration, Effect, Encoding, Redacted, Result } from "effect";

import { GitHubAppKeyInvalid } from "./github-app-key-invalid.ts";

type GitHubAppKey = Readonly<{ appId: string; privateKey: Redacted.Redacted }>;

const jwtClockSkewSeconds = 60;
const jwtLifetimeSeconds = 540;
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

const lengthBytes = (byteCount: number): readonly number[] =>
  byteCount === 0
    ? []
    : [...lengthBytes(Math.floor(byteCount / (byteMask + 1))), byteCount % (byteMask + 1)];

const derLength = (byteCount: number): Uint8Array => {
  const longForm = lengthBytes(byteCount);
  return byteCount < derShortLengthLimit
    ? Uint8Array.of(byteCount)
    : Uint8Array.of(derShortLengthLimit | longForm.length, ...longForm);
};

const derElement = (tag: number, ...derParts: readonly Uint8Array[]): Uint8Array => {
  const derBody = derParts.flatMap((part) => [...part]);
  return Uint8Array.of(tag, ...derLength(derBody.length), ...derBody);
};

const pkcs8Key = (pem: string): Effect.Effect<Uint8Array, GitHubAppKeyInvalid> => {
  const pemBody = pem.replaceAll(/-----(?:BEGIN|END) (?:RSA )?PRIVATE KEY-----|\s/gu, "");
  const decoded = Encoding.decodeBase64(pemBody);
  if (Result.isFailure(decoded)) {
    return Effect.fail(new GitHubAppKeyInvalid({ cause: decoded.failure }));
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
};

const jsonSegment = (jwtPart: unknown): string =>
  Encoding.encodeBase64Url(new TextEncoder().encode(JSON.stringify(jwtPart)));

const signGitHubAppJwt = Effect.fn("signGitHubAppJwt")(function* signGitHubAppJwt(
  appKey: GitHubAppKey,
) {
  const der = yield* pkcs8Key(Redacted.value(appKey.privateKey));
  const signingKey = yield* Effect.tryPromise({
    catch: (cause) => new GitHubAppKeyInvalid({ cause }),
    try: () =>
      crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(der),
        { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
        false,
        ["sign"],
      ),
  });
  const issuedAtSeconds = Math.floor(
    Duration.toSeconds(Duration.millis(yield* Clock.currentTimeMillis)),
  );
  const unsigned = `${jsonSegment({ alg: "RS256", typ: "JWT" })}.${jsonSegment({
    exp: issuedAtSeconds + jwtLifetimeSeconds,
    iat: issuedAtSeconds - jwtClockSkewSeconds,
    iss: appKey.appId,
  })}`;
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, new TextEncoder().encode(unsigned)),
  );
  return Redacted.make(`${unsigned}.${Encoding.encodeBase64Url(new Uint8Array(signature))}`);
});

export { signGitHubAppJwt };
export type { GitHubAppKey };
