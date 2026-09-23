import { getSessionCookie } from "better-auth/cookies";
import { getCryptoKey } from "better-auth/crypto";
import { Effect } from "effect";

const signatureLength = 44;

const sessionTokenFrom = Effect.fn("sessionTokenFrom")(function* sessionTokenFrom(
  headers: Headers,
  cookiePrefix: string,
  secret: string,
) {
  const raw = getSessionCookie(headers, { cookiePrefix });
  if (raw === null) {
    return undefined;
  }
  const signatureStart = raw.lastIndexOf(".");
  if (signatureStart < 1) {
    return undefined;
  }
  const value = raw.slice(0, signatureStart);
  const signature = raw.slice(signatureStart + 1);
  if (signature.length !== signatureLength || !signature.endsWith("=")) {
    return undefined;
  }
  const binary = atob(signature);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const valid = yield* Effect.tryPromise(() =>
    getCryptoKey(secret).then((key) =>
      crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(value)),
    ),
  ).pipe(Effect.orElseSucceed(() => false));
  return valid ? value : undefined;
});

export { sessionTokenFrom };
