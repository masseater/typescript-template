import { getSessionCookie } from "better-auth/cookies";
import { getCryptoKey } from "better-auth/crypto";

const signatureLength = 44;

async function sessionTokenFrom(
  headers: Headers,
  cookiePrefix: string,
  secret: string,
): Promise<string | undefined> {
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
  try {
    const binary = atob(signature);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getCryptoKey(secret),
      bytes,
      new TextEncoder().encode(value),
    );
    return valid ? value : undefined;
  } catch {
    return undefined;
  }
}

export { sessionTokenFrom };
