import { Effect, Encoding, Option, Result, Schema } from "effect";

type GitHubAppKeyFixture = Readonly<{
  privateKey: string;
  signedBy: (authorization: string | null, appId: string) => Promise<boolean>;
}>;

const rsaModulusLength = 2048;
const pemLineLength = 64;
const pkcs1Offset = 26;
const JwtClaims = Schema.fromJsonString(Schema.Struct({ iss: Schema.String }));

const pem = (pemLabel: string, der: ArrayBuffer): string =>
  `-----BEGIN ${pemLabel}-----\n${(Encoding.encodeBase64(new Uint8Array(der)).match(new RegExp(`.{1,${String(pemLineLength)}}`, "gu")) ?? []).join("\n")}\n-----END ${pemLabel}-----\n`;

const decodeSegment = (segment: string): Uint8Array =>
  Result.getOrElse(Encoding.decodeBase64Url(segment), () => new Uint8Array());

const jwtIssuer = (claimsSegment: string): Option.Option<string> =>
  Option.map(
    Schema.decodeOption(JwtClaims)(new TextDecoder().decode(decodeSegment(claimsSegment))),
    (claims) => claims.iss,
  );

const gitHubAppKeyFixture = Effect.fn("gitHubAppKeyFixture")(function* gitHubAppKeyFixture(
  format: "pkcs1" | "pkcs8",
) {
  const keyPair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      {
        hash: "SHA-256",
        modulusLength: rsaModulusLength,
        name: "RSASSA-PKCS1-v1_5",
        publicExponent: Uint8Array.of(1, 0, 1),
      },
      true,
      ["sign", "verify"],
    ),
  ).pipe(
    Effect.filterOrFail(
      (generated): generated is { privateKey: CryptoKey; publicKey: CryptoKey } =>
        "privateKey" in generated,
    ),
  );
  const pkcs8 = yield* Effect.promise(() =>
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ).pipe(
    Effect.filterOrFail((exported): exported is ArrayBuffer => exported instanceof ArrayBuffer),
  );
  const services = yield* Effect.context();
  const signedBy = (authorization: string | null, appId: string): Promise<boolean> => {
    const [header = "", claimsSegment = "", signature = ""] = (authorization ?? "")
      .replace(/^Bearer /u, "")
      .split(".");
    return Effect.runPromiseWith(services)(
      Effect.promise(() =>
        crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          keyPair.publicKey,
          new Uint8Array(decodeSegment(signature)),
          new TextEncoder().encode(`${header}.${claimsSegment}`),
        ),
      ).pipe(
        Effect.map((verified) => verified && Option.contains(jwtIssuer(claimsSegment), appId)),
      ),
    );
  };
  return {
    privateKey:
      format === "pkcs8"
        ? pem("PRIVATE KEY", pkcs8)
        : pem("RSA PRIVATE KEY", pkcs8.slice(pkcs1Offset)),
    signedBy,
  } satisfies GitHubAppKeyFixture;
}, Effect.orDie);

export { gitHubAppKeyFixture };
export type { GitHubAppKeyFixture };
