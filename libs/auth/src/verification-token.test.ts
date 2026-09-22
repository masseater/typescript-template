import { Encoding, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { emailChangeTarget } from "./verification-token.ts";

const claimsToken = (claims: unknown): string =>
  `hdr.${Encoding.encodeBase64Url(JSON.stringify(claims))}.sig`;

describe("emailChangeTarget", () => {
  it("treats a decoded token without updateTo as signup verification", () => {
    expect.hasAssertions();
    const target = emailChangeTarget(claimsToken({}));
    expect(Result.isSuccess(target)).toBe(true);
    if (Result.isFailure(target)) {
      return;
    }
    expect(target.success).toBeUndefined();
  });

  it("returns the email-change destination when updateTo is present", () => {
    expect.hasAssertions();
    const target = emailChangeTarget(claimsToken({ updateTo: "next@example.com" }));
    expect(Result.isSuccess(target)).toBe(true);
    if (Result.isFailure(target)) {
      return;
    }
    expect(target.success).toBe("next@example.com");
  });

  it("fails closed when the claims segment cannot be decoded", () => {
    expect.hasAssertions();
    const target = emailChangeTarget("hdr.!!!not-base64!!!.sig");
    expect(Result.isFailure(target)).toBe(true);
    if (Result.isSuccess(target)) {
      return;
    }
    expect(target.failure._tag).toBe("VerificationTokenInvalid");
  });

  it("fails closed when the token has no claims segment", () => {
    expect.hasAssertions();
    const target = emailChangeTarget("opaque-token");
    expect(Result.isFailure(target)).toBe(true);
    if (Result.isSuccess(target)) {
      return;
    }
    expect(target.failure._tag).toBe("VerificationTokenInvalid");
  });
});
