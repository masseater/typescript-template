import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { EmailVerificationRequest, EmailVerified, ErrorBody } from "./contracts.ts";

const maximumTokenLength = 4096;

describe("an email verification request carrying the token the mail link holds", () => {
  const it = test.extend("decodedRequest", () =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(EmailVerificationRequest, { onExcessProperty: "error" })({
        token: "a".repeat(maximumTokenLength),
      }),
    ));

  it("keeps the token", ({ decodedRequest }) => {
    expect(decodedRequest).toStrictEqual({ token: "a".repeat(maximumTokenLength) });
  });
});

describe.for([
  ["no token at all", {}],
  ["an empty token", { token: "" }],
  ["a token past the limit", { token: "a".repeat(maximumTokenLength + 1) }],
] as const)("an email verification request with %s", ([, input]) => {
  const it = test.extend("rejectionTag", () =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(EmailVerificationRequest, { onExcessProperty: "error" })(
        input,
      ).pipe(
        Effect.flip,
        Effect.map((failure) => failure._tag),
      ),
    ));

  it("is rejected", ({ rejectionTag }) => {
    expect(rejectionTag).toBe("SchemaError");
  });
});

describe("an email verification answer", () => {
  const it = test.extend("verificationAnswers", () =>
    Effect.runPromise(
      Effect.gen(function* verificationAnswersProgram() {
        const decodeVerified = Schema.decodeUnknownEffect(EmailVerified, {
          onExcessProperty: "error",
        });
        const verified = yield* decodeVerified({ verified: true });
        const unverified = yield* decodeVerified({ verified: false }).pipe(Effect.flip);
        return { unverified: unverified._tag, verified };
      }),
    ));

  it("is only ever verified", ({ verificationAnswers }) => {
    expect(verificationAnswers).toStrictEqual({
      unverified: "SchemaError",
      verified: { verified: true },
    });
  });
});

describe("an error body", () => {
  const it = test.extend("errorBodies", () =>
    Effect.runPromise(
      Effect.gen(function* errorBodiesProgram() {
        const decodeError = Schema.decodeUnknownEffect(ErrorBody, { onExcessProperty: "error" });
        const named = yield* decodeError({ error: "だめでした。" });
        const unnamed = yield* decodeError({}).pipe(Effect.flip);
        return { named, unnamed: unnamed._tag };
      }),
    ));

  it("names the error in every failed answer", ({ errorBodies }) => {
    expect(errorBodies).toStrictEqual({ named: { error: "だめでした。" }, unnamed: "SchemaError" });
  });
});
