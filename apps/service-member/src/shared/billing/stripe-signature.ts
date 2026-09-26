import { Clock, Effect, Encoding, Redacted, Result } from "effect";

import { StripeSignatureInvalid } from "./stripe-signature-invalid.ts";

const signatureToleranceSeconds = 300;
const millisecondsPerSecond = 1000;
const byteWidth = 2;

interface SignatureHeader {
  readonly signatures: readonly string[];
  readonly timestamp: number;
}

function parseSignatureHeader(header: string): SignatureHeader | undefined {
  const fields = header.split(",").map((field) => field.split("=", byteWidth));
  const timestampField = fields.find(([key]) => key === "t")?.[1];
  const signatures = fields.flatMap(([key, value]) =>
    key === "v1" && value !== undefined ? [value] : [],
  );
  const timestamp = Number(timestampField);
  if (timestampField === undefined || !Number.isInteger(timestamp) || signatures.length === 0) {
    return undefined;
  }
  return { signatures, timestamp };
}

const verificationKey = (secret: Redacted.Redacted): Effect.Effect<CryptoKey> =>
  Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Redacted.value(secret)),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["verify"],
    ),
  );

const signatureMatches = (
  key: CryptoKey,
  signed: Readonly<{ payload: Uint8Array<ArrayBuffer>; signature: string }>,
): Effect.Effect<boolean> =>
  Result.match(Encoding.decodeHex(signed.signature), {
    onFailure: () => Effect.succeed(false),
    onSuccess: (signature) =>
      Effect.promise(() => crypto.subtle.verify("HMAC", key, signature, signed.payload)),
  });

const verifyStripeSignature = Effect.fn("verifyStripeSignature")(function* verifyStripeSignature(
  secret: Redacted.Redacted,
  payload: string,
  header: string | null,
) {
  const parsed = header === null ? undefined : parseSignatureHeader(header);
  if (parsed === undefined) {
    return yield* new StripeSignatureInvalid({ reason: "header_malformed" });
  }
  const key = yield* verificationKey(secret);
  const signedPayload = new TextEncoder().encode(`${parsed.timestamp}.${payload}`);
  const matches = yield* Effect.forEach(parsed.signatures, (signature) =>
    signatureMatches(key, { payload: signedPayload, signature }),
  );
  if (!matches.includes(true)) {
    return yield* new StripeSignatureInvalid({ reason: "mismatch" });
  }
  const nowSeconds = Math.floor((yield* Clock.currentTimeMillis) / millisecondsPerSecond);
  if (Math.abs(nowSeconds - parsed.timestamp) > signatureToleranceSeconds) {
    return yield* new StripeSignatureInvalid({ reason: "stale" });
  }
});

export { verifyStripeSignature };
