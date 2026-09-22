import { Encoding, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { emailChangeTarget } from "./verification-token.ts";

const claimsToken = (claims: unknown): string =>
  `hdr.${Encoding.encodeBase64Url(JSON.stringify(claims))}.sig`;

describe("emailChangeTarget", () => {
  test("treats a decoded token without updateTo as signup verification", () => {
    const target = emailChangeTarget(claimsToken({}));
    expect(Result.isSuccess(target)).toBe(true);
    if (Result.isFailure(target)) {
      return;
    }
    expect(target.success).toBeUndefined();
  });

  test("returns the email-change destination when updateTo is present", () => {
    const target = emailChangeTarget(claimsToken({ updateTo: "next@example.com" }));
    expect(Result.isSuccess(target)).toBe(true);
    if (Result.isFailure(target)) {
      return;
    }
    expect(target.success).toBe("next@example.com");
  });

  test("fails closed when the claims segment cannot be decoded", () => {
    const target = emailChangeTarget("hdr.!!!not-base64!!!.sig");
    expect(Result.isFailure(target)).toBe(true);
    if (Result.isSuccess(target)) {
      return;
    }
    expect(target.failure._tag).toBe("VerificationTokenInvalid");
  });

  test("fails closed when the token has no claims segment", () => {
    const target = emailChangeTarget("opaque-token");
    expect(Result.isFailure(target)).toBe(true);
    if (Result.isSuccess(target)) {
      return;
    }
    expect(target.failure._tag).toBe("VerificationTokenInvalid");
  });
});
