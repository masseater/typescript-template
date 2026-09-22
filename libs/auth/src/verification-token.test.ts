import { Encoding, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { emailChangeTarget } from "./verification-token.ts";

const claimsToken = (claims: unknown): string =>
  `hdr.${Encoding.encodeBase64Url(JSON.stringify(claims))}.sig`;

const failureTag = (token: string): string => {
  const target = emailChangeTarget(token);
  return Result.isFailure(target) ? target.failure._tag : "success";
};

describe("emailChangeTarget", () => {
  const it = test
    .extend("signupTarget", () => emailChangeTarget(claimsToken({})))
    .extend("changeTarget", () => emailChangeTarget(claimsToken({ updateTo: "next@example.com" })))
    .extend("undecodableTag", () => failureTag("hdr.!!!not-base64!!!.sig"))
    .extend("opaqueTag", () => failureTag("opaque-token"));

  it("treats a decoded token without updateTo as signup verification", ({ signupTarget }) => {
    expect(signupTarget).toStrictEqual(Result.succeed(undefined));
  });

  it("returns the email-change destination when updateTo is present", ({ changeTarget }) => {
    expect(changeTarget).toStrictEqual(Result.succeed("next@example.com"));
  });

  it("fails closed when the claims segment cannot be decoded", ({ undecodableTag }) => {
    expect(undecodableTag).toBe("VerificationTokenInvalid");
  });

  it("fails closed when the token has no claims segment", ({ opaqueTag }) => {
    expect(opaqueTag).toBe("VerificationTokenInvalid");
  });
});
