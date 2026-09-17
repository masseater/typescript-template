import { decodeBrowserBatch, object, safeFailure, shellQuote } from "./support.ts";
import { describe, expect, it } from "vite-plus/test";
import { totp } from "./totp.ts";
import { verificationLink } from "./mail.ts";

const rfc6238FirstVectorTime = 59_000;
const rfc6238SecondVectorTime = 1_111_111_109_000;
const rfc6238ThirdVectorTime = 2_000_000_000_000;

describe("one-time password generation", () => {
  it("computes the RFC 6238 SHA-1 vectors using real HMAC", () => {
    expect.hasAssertions();
    const uri = "otpauth://totp/test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8";
    expect(totp(uri, rfc6238FirstVectorTime)).toBe("94287082");
    expect(totp(uri, rfc6238SecondVectorTime)).toBe("07081804");
    expect(totp(uri, rfc6238ThirdVectorTime)).toBe("69279037");
  });

  it("rejects unsupported algorithms and non-base32 input", () => {
    expect.hasAssertions();
    expect(() => totp("otpauth://totp/test?secret=INVALID0")).toThrow("E2E_INVALID_TOTP_SECRET");
    expect(() => totp("otpauth://totp/test?secret=AAAA&algorithm=MD5")).toThrow(
      "E2E_INVALID_TOTP_PARAMETERS",
    );
  });
});

describe("verification link extraction", () => {
  it("must target this isolated worker and real verification route", () => {
    expect.hasAssertions();
    const origin = "http://localhost:12345";
    const url = `${origin}/api/auth/verify-email?token=public-test-vector`;
    expect(verificationLink(`Verify:\n${url}`, origin)).toBe(url);
    expect(() =>
      verificationLink("https://outside.example/api/auth/verify-email?token=x", origin),
    ).toThrow("E2E_VERIFICATION_LINK_MISSING");
    expect(() => verificationLink(`${origin}/api/auth/verify-email`, origin)).toThrow(
      "E2E_VERIFICATION_LINK_MISSING",
    );
  });
});

describe("browser batch decoding", () => {
  it("never propagates echoed inputs or browser error details on command failures", () => {
    expect.hasAssertions();
    expect(() =>
      decodeBrowserBatch(
        JSON.stringify([
          {
            command: ["fill", "password", "secret-canary"],
            error: "secret-canary",
            success: false,
          },
        ]),
      ),
    ).toThrow(/^E2E_BROWSER_COMMAND_FAILED$/u);
    expect(
      decodeBrowserBatch('[{"success":true,"result":{"value":1},"command":["private"]}]'),
    ).toStrictEqual([{ value: 1 }]);
    expect(() => object(JSON.parse("null"))).toThrow("E2E_INVALID_OBJECT_RESPONSE");
  });
});

describe("fish shell quoting", () => {
  it("treats special characters as literal fish path text", () => {
    expect.hasAssertions();
    expect(shellQuote(String.raw`a'b\c$() ;`)).toBe(String.raw`'a\'b\\c$() ;'`);
  });
});

describe("failure sanitizing", () => {
  it("drops provider messages, secrets and nested causes", () => {
    expect.hasAssertions();
    const error = safeFailure(
      new Error("secret-canary", { cause: new Error("token-canary") }),
      "registration",
    );
    expect(error.message).toMatch(
      /^E2E_OPERATION_FAILED; stage=registration; error=Error; at=pure\.test\.ts:\d+$/u,
    );
    expect(error.message).not.toMatch(/canary/u);
    const provider = new TypeError("secret-canary");
    provider.stack = "TypeError: secret-canary\n    at /tmp/secret-canary.ts:1:1";
    expect(safeFailure(provider, "totp").message).toBe(
      "E2E_OPERATION_FAILED; stage=totp; error=TypeError",
    );
    expect(error.cause).toBeUndefined();
    expect(safeFailure(new Error("E2E_VERIFIED_LOGIN_FAILED"), "registration").message).toBe(
      "E2E_VERIFIED_LOGIN_FAILED; stage=registration",
    );
  });
});
