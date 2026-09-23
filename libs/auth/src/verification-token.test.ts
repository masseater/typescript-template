import { assert, describe, it } from "@effect/vitest";
import { Effect, Encoding, Result } from "effect";

import { emailChangeTarget } from "./verification-token.ts";

const claimsToken = (claims: unknown): string =>
  `hdr.${Encoding.encodeBase64Url(JSON.stringify(claims))}.sig`;

describe("emailChangeTarget", () => {
  it.effect("treats a decoded token without updateTo as signup verification", () =>
    Effect.sync(() => {
      const target = emailChangeTarget(claimsToken({}));
      assert.isTrue(Result.isSuccess(target));
      if (Result.isFailure(target)) {
        return;
      }
      assert.isUndefined(target.success);
    }),
  );

  it.effect("returns the email-change destination when updateTo is present", () =>
    Effect.sync(() => {
      const target = emailChangeTarget(claimsToken({ updateTo: "next@example.com" }));
      assert.isTrue(Result.isSuccess(target));
      if (Result.isFailure(target)) {
        return;
      }
      assert.strictEqual(target.success, "next@example.com");
    }),
  );

  it.effect("fails closed when the claims segment cannot be decoded", () =>
    Effect.sync(() => {
      const target = emailChangeTarget("hdr.!!!not-base64!!!.sig");
      assert.isTrue(Result.isFailure(target));
      if (Result.isSuccess(target)) {
        return;
      }
      assert.strictEqual(target.failure._tag, "VerificationTokenInvalid");
    }),
  );

  it.effect("fails closed when the token has no claims segment", () =>
    Effect.sync(() => {
      const target = emailChangeTarget("opaque-token");
      assert.isTrue(Result.isFailure(target));
      if (Result.isSuccess(target)) {
        return;
      }
      assert.strictEqual(target.failure._tag, "VerificationTokenInvalid");
    }),
  );
});
