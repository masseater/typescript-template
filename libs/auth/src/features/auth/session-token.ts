import { getSessionCookie } from "better-auth/cookies";
import { getCryptoKey } from "better-auth/crypto";
import { Effect } from "effect";

const signatureLength = 44;

const signatureBytesOf = (signature: string): ArrayBuffer =>
  Uint8Array.from(atob(signature), (character) => character.charCodeAt(0)).buffer;

const verifySignedToken = Effect.fn("verifySignedToken")(function* verifySignedToken({
  secret,
  signature,
  tokenValue,
}: {
  readonly secret: string;
  readonly signature: string;
  readonly tokenValue: string;
}) {
  const cryptoKey = yield* Effect.tryPromise(() => getCryptoKey(secret)).pipe(
    Effect.orElseSucceed(() => null),
  );
  if (cryptoKey === null) {
    return false;
  }
  return yield* Effect.tryPromise(() =>
    crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytesOf(signature),
      new TextEncoder().encode(tokenValue),
    ),
  ).pipe(Effect.orElseSucceed(() => false));
});

const sessionTokenFrom = Effect.fn("sessionTokenFrom")(function* sessionTokenFrom({
  cookiePrefix,
  headers,
  secret,
}: {
  readonly cookiePrefix: string;
  readonly headers: Headers;
  readonly secret: string;
}) {
  const raw = getSessionCookie(headers, { cookiePrefix });
  if (raw === null) {
    return undefined;
  }
  const signatureStart = raw.lastIndexOf(".");
  if (signatureStart < 1) {
    return undefined;
  }
  const tokenValue = raw.slice(0, signatureStart);
  const signature = raw.slice(signatureStart + 1);
  if (signature.length !== signatureLength || !signature.endsWith("=")) {
    return undefined;
  }
  const valid = yield* verifySignedToken({ secret, signature, tokenValue });
  return valid ? tokenValue : undefined;
});

export { sessionTokenFrom };
