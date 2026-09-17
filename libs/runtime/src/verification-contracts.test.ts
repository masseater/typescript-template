import { Effect, Schema } from "effect";
import { EmailVerificationRequest, EmailVerified, ErrorBody } from "./contracts.ts";
import { assert, describe, it } from "@effect/vitest";

const maximumTokenLength = 4096;
const decodeRequest = Schema.decodeUnknownEffect(EmailVerificationRequest, {
  onExcessProperty: "error",
});
const decodeVerified = Schema.decodeUnknownEffect(EmailVerified, { onExcessProperty: "error" });
const decodeError = Schema.decodeUnknownEffect(ErrorBody, { onExcessProperty: "error" });

describe("email verification contracts", () => {
  it.effect("carries the token the mail link holds", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeRequest({ token: "a".repeat(maximumTokenLength) }), {
        token: "a".repeat(maximumTokenLength),
      });
    }),
  );

  it.effect.each([{}, { token: "" }, { token: "a".repeat(maximumTokenLength + 1) }])(
    "rejects the verification request %o",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (input) =>
      Effect.gen(function* program() {
        const failure = yield* decodeRequest(input).pipe(Effect.flip);
        assert.strictEqual(failure._tag, "SchemaError");
      }),
  );

  it.effect("answers a verification only as verified", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeVerified({ verified: true }), { verified: true });
      const failure = yield* decodeVerified({ verified: false }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "SchemaError");
    }),
  );

  it.effect("names the error in every failed answer", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decodeError({ error: "だめでした。" }), {
        error: "だめでした。",
      });
      const failure = yield* decodeError({}).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "SchemaError");
    }),
  );
});
