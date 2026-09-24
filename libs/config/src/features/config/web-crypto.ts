import { Crypto, Effect } from "effect";

const webCrypto = Crypto.make({
  digest: (algorithm, digestInput) =>
    Effect.tryPromise(() => crypto.subtle.digest(algorithm, Uint8Array.from(digestInput))).pipe(
      Effect.map((digestBytes) => new Uint8Array(digestBytes)),
      Effect.orDie,
    ),
  randomBytes: (byteCount) => crypto.getRandomValues(new Uint8Array(byteCount)),
});

export { webCrypto };
