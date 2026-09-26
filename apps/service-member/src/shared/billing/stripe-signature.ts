import { Clock, Effect, Encoding, Redacted } from "effect";

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

function sameDigest(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) {
    return false;
  }
  const difference = Array.from(expected).reduce(
    (accumulated, character, index) =>
      accumulated | (character.charCodeAt(0) ^ candidate.charCodeAt(index)),
    0,
  );
  return difference === 0;
}

const signPayload = Effect.fn("signStripePayload")(function* signStripePayload(
  secret: Redacted.Redacted,
  signedPayload: string,
) {
  const encoder = new TextEncoder();
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      encoder.encode(Redacted.value(secret)),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"],
    ),
  );
  const digest = yield* Effect.promise(() =>
    crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload)),
  );
  return Encoding.encodeHex(new Uint8Array(digest));
});

const verifyStripeSignature = Effect.fn("verifyStripeSignature")(function* verifyStripeSignature(
  secret: Redacted.Redacted,
  payload: string,
  header: string | null,
) {
  const parsed = header === null ? undefined : parseSignatureHeader(header);
  if (parsed === undefined) {
    return yield* StripeSignatureInvalid.make({ reason: "header_malformed" });
  }
  const expected = yield* signPayload(secret, `${parsed.timestamp}.${payload}`);
  if (!parsed.signatures.some((signature) => sameDigest(expected, signature))) {
    return yield* StripeSignatureInvalid.make({ reason: "mismatch" });
  }
  const nowSeconds = Math.floor((yield* Clock.currentTimeMillis) / millisecondsPerSecond);
  if (Math.abs(nowSeconds - parsed.timestamp) > signatureToleranceSeconds) {
    return yield* StripeSignatureInvalid.make({ reason: "stale" });
  }
});

export { verifyStripeSignature };
